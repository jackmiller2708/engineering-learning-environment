import { describe, expect, it } from 'vitest';
import { decodeManifest, encodeManifest } from './manifest';
import { createWorkspace, type Workspace } from './workspace';

const ID = '4f525f09-3c12-449f-872b-c148c25e63ba';
const AT = '2026-11-17T07:05:09Z';

const make = (name: string): Workspace => {
  const r = createWorkspace({ id: ID, name, now: new Date(AT) });
  if (!r.ok) throw new Error('setup failed');
  return r.value;
};

/** A valid manifest object as text, with optional overrides (undefined removes the field). */
const manifest = (over: Record<string, unknown> = {}): string => {
  const base: Record<string, unknown> = { schemaVersion: 1, id: ID, name: 'Alpha', createdAt: AT };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete base[k];
    else base[k] = v;
  }
  return JSON.stringify(base);
};

describe('encodeManifest', () => {
  it('writes fixed key order, two-space indent and a trailing newline', () => {
    expect(encodeManifest(make('Alpha'))).toBe(
      `{\n  "schemaVersion": 1,\n  "id": "${ID}",\n  "name": "Alpha",\n  "createdAt": "${AT}"\n}\n`,
    );
  });

  it('is deterministic', () => {
    expect(encodeManifest(make('Alpha'))).toBe(encodeManifest(make('Alpha')));
  });

  it.each(['A "quoted" name', 'back\\slash', 'caf\u00E9', 'cafe\u0301', '\u{1F600} emoji'])(
    'round-trips %j exactly',
    (name) => {
      const ws = make(name);
      expect(decodeManifest(encodeManifest(ws))).toEqual({ ok: true, value: ws });
    },
  );
});

describe('decodeManifest: accepted input', () => {
  it('decodes a valid manifest', () => {
    expect(decodeManifest(manifest())).toEqual({
      ok: true,
      value: { schemaVersion: 1, id: ID, name: 'Alpha', createdAt: AT },
    });
  });

  it('accepts any JSON layout (compact, indented, reordered keys)', () => {
    const reordered = `{ "createdAt": "${AT}",\n\t"name": "Alpha", "id": "${ID}", "schemaVersion": 1 }`;
    expect(decodeManifest(reordered).ok).toBe(true);
  });

  it('ignores unknown properties, including "__proto__"', () => {
    const text = `{"schemaVersion":1,"id":"${ID}","name":"Alpha","createdAt":"${AT}","future":{"a":[1]},"__proto__":{"name":"Evil"}}`;
    const r = decodeManifest(text);
    expect(r).toEqual({ ok: true, value: { schemaVersion: 1, id: ID, name: 'Alpha', createdAt: AT } });
  });

  it('returns the stored name unchanged (no normalization, no case change)', () => {
    const r = decodeManifest(manifest({ name: 'Cafe\u0301 \u00C4' }));
    expect(r.ok && r.value.name).toBe('Cafe\u0301 \u00C4');
  });
});

describe('decodeManifest: malformed or wrong-shaped JSON', () => {
  it.each(['', '{', '{"a":1,}', 'nul', 'undefined', "{'a':1}", '\uFEFF' + manifest()])(
    'rejects %j as malformed_json',
    (text) => {
      expect(decodeManifest(text)).toEqual({ ok: false, error: { code: 'malformed_json' } });
    },
  );

  it.each(['null', '[]', '[1]', '1', '"text"', 'true'])('rejects %s as not_an_object', (text) => {
    expect(decodeManifest(text)).toEqual({ ok: false, error: { code: 'not_an_object' } });
  });
});

describe('decodeManifest: schema version', () => {
  it.each([undefined, '1', 1.5, null, true, [1]])('rejects %j as invalid_schema_version', (v) => {
    expect(decodeManifest(manifest({ schemaVersion: v }))).toEqual({
      ok: false,
      error: { code: 'invalid_schema_version' },
    });
  });

  it.each([0, 2, -1, 1000])('rejects version %d as unsupported_version', (version) => {
    expect(decodeManifest(manifest({ schemaVersion: version }))).toEqual({
      ok: false,
      error: { code: 'unsupported_version', version },
    });
  });

  it('reports an unsupported version before looking at other fields', () => {
    expect(decodeManifest('{"schemaVersion":2,"id":"garbage"}')).toEqual({
      ok: false,
      error: { code: 'unsupported_version', version: 2 },
    });
  });
});

describe('decodeManifest: field validation (never repairs)', () => {
  it.each([
    ['id missing', { id: undefined }, { field: 'id', code: 'missing' }],
    ['id not a string', { id: 7 }, { field: 'id', code: 'not_a_string' }],
    ['id uppercase', { id: ID.toUpperCase() }, { field: 'id', code: 'invalid_id' }],
    ['id version 1', { id: '4f525f09-3c12-149f-872b-c148c25e63ba' }, { field: 'id', code: 'invalid_id' }],
    ['name missing', { name: undefined }, { field: 'name', code: 'missing' }],
    ['name not a string', { name: ['Alpha'] }, { field: 'name', code: 'not_a_string' }],
    ['name empty', { name: '' }, { field: 'name', code: 'empty' }],
    ['name with leading space', { name: ' Alpha' }, { field: 'name', code: 'not_trimmed' }],
    ['name with trailing NEL', { name: 'Alpha\u0085' }, { field: 'name', code: 'not_trimmed' }],
    ['name with a tab', { name: 'A\tB' }, { field: 'name', code: 'control_character' }],
    ['name over 64', { name: 'a'.repeat(65) }, { field: 'name', code: 'too_long' }],
    ['createdAt missing', { createdAt: undefined }, { field: 'createdAt', code: 'missing' }],
    ['createdAt not a string', { createdAt: 1763363109 }, { field: 'createdAt', code: 'not_a_string' }],
    ['createdAt with fraction', { createdAt: '2026-11-17T07:05:09.000Z' }, { field: 'createdAt', code: 'invalid_timestamp' }],
    ['createdAt with offset', { createdAt: '2026-11-17T07:05:09+00:00' }, { field: 'createdAt', code: 'invalid_timestamp' }],
    ['createdAt before 1970', { createdAt: '1960-01-01T00:00:00Z' }, { field: 'createdAt', code: 'timestamp_out_of_range' }],
  ])('rejects %s', (_label, over, error) => {
    expect(decodeManifest(manifest(over))).toEqual({ ok: false, error });
  });

  it('rejects an unpaired surrogate written as a JSON escape', () => {
    const text = `{"schemaVersion":1,"id":"${ID}","name":"\\ud800","createdAt":"${AT}"}`;
    expect(decodeManifest(text)).toEqual({ ok: false, error: { field: 'name', code: 'malformed_utf16' } });
  });

  it('reports the first problem in the order id, name, createdAt', () => {
    expect(decodeManifest(manifest({ id: 'x', name: '', createdAt: 'y' }))).toEqual({
      ok: false,
      error: { field: 'id', code: 'invalid_id' },
    });
    expect(decodeManifest(manifest({ name: '', createdAt: 'y' }))).toEqual({
      ok: false,
      error: { field: 'name', code: 'empty' },
    });
  });
});
