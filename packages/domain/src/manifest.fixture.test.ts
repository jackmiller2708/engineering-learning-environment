import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/workspace-manifest.json';
import { decodeManifest } from './manifest';

type Expect =
  | { ok: true; workspace: { id: string; name: string; createdAt: string } }
  | { ok: false; error: Record<string, unknown> };

describe('decodeManifest (shared fixture, TypeScript is the reference)', () => {
  it('has no duplicate case ids', () => {
    const ids = fixture.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(fixture.cases)('$id: $note', (c) => {
    const expected = c.expect as Expect;
    const actual = decodeManifest(c.input);
    if (expected.ok) {
      expect(actual).toEqual({ ok: true, value: { schemaVersion: 1, ...expected.workspace } });
    } else {
      expect(actual).toEqual({ ok: false, error: expected.error });
    }
  });
});
