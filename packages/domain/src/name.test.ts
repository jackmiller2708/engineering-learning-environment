import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/workspace-name.json';
import casefold from '../fixtures/casefold-unicode-18.0.0.json';
import {
  WORKSPACE_NAME_MAX_LENGTH,
  parseStoredWorkspaceName,
  validateWorkspaceName,
  workspaceNameKey,
} from './name';

type Expect = { ok: true; name: string } | { ok: false; error: string };
type Case = { id: string; note: string; expect: Expect; input?: string; inputUtf16CodeUnits?: number[] };

/** Cases with unpaired surrogates give UTF-16 code units, since JSON text cannot carry them portably. */
const inputOf = (c: Case): string => c.input ?? String.fromCharCode(...(c.inputUtf16CodeUnits ?? []));

function expectOutcome(actual: ReturnType<typeof parseStoredWorkspaceName>, expected: Expect): void {
  if (expected.ok) {
    expect(actual).toEqual({ ok: true, value: expected.name });
  } else {
    expect(actual).toEqual({ ok: false, error: expected.error });
  }
}

const mustName = (text: string) => {
  const r = validateWorkspaceName(text);
  if (!r.ok) throw new Error(`fixture name rejected: ${r.error}`);
  return r.value;
};

describe('validateWorkspaceName (shared fixture)', () => {
  it('uses the documented limit', () => {
    expect(WORKSPACE_NAME_MAX_LENGTH).toBe(fixture.rules.maxScalarValues);
  });

  it.each(fixture.validation)('$id: $note', (c) => {
    expectOutcome(validateWorkspaceName(inputOf(c as Case)), c.expect as Expect);
  });
});

describe('parseStoredWorkspaceName (shared fixture)', () => {
  it.each(fixture.storedNames)('$id', (c) => {
    expectOutcome(parseStoredWorkspaceName(c.input), c.expect as Expect);
  });
});

describe('Unicode White_Space and Cc, checked over every scalar value', () => {
  const scalars = function* () {
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp < 0xd800 || cp > 0xdfff) yield cp;
    }
  };
  const ws = new Set<number>(fixture.rules.trimmedWhiteSpaceCodePoints);
  const cc = new Set<number>(fixture.rules.controlCodePoints);

  it('the fixture White_Space list equals the engine property \\p{White_Space}', () => {
    const wsRegex = /\p{White_Space}/u;
    const mismatches: number[] = [];
    for (const cp of scalars()) {
      if (wsRegex.test(String.fromCodePoint(cp)) !== ws.has(cp)) mismatches.push(cp);
    }
    expect(mismatches).toEqual([]);
  });

  it('the fixture Cc list equals the engine property \\p{Cc}', () => {
    const ccRegex = /\p{Cc}/u;
    const mismatches: number[] = [];
    for (const cp of scalars()) {
      if (ccRegex.test(String.fromCodePoint(cp)) !== cc.has(cp)) mismatches.push(cp);
    }
    expect(mismatches).toEqual([]);
  });

  it('trims exactly the White_Space code points at both edges', () => {
    const wrong: number[] = [];
    for (const cp of scalars()) {
      const ch = String.fromCodePoint(cp);
      const r = validateWorkspaceName(`${ch}x${ch}`);
      const trimmed = r.ok && r.value === 'x';
      if (trimmed !== ws.has(cp)) wrong.push(cp);
    }
    expect(wrong).toEqual([]);
  });

  it('rejects exactly the Cc code points inside a name', () => {
    const wrong: number[] = [];
    for (const cp of scalars()) {
      const r = validateWorkspaceName(`a${String.fromCodePoint(cp)}b`);
      const rejected = !r.ok && r.error === 'control_character';
      if (rejected !== cc.has(cp)) wrong.push(cp);
      if (!rejected && !r.ok) wrong.push(cp);
    }
    expect(wrong).toEqual([]);
  });
});

describe('workspaceNameKey', () => {
  it.each(fixture.keys)('key of %j', (c) => {
    expect(workspaceNameKey(mustName(c.name))).toBe(c.key);
  });

  it.each(fixture.comparison)('$id: $note', (c) => {
    const same = workspaceNameKey(mustName(c.a)) === workspaceNameKey(mustName(c.b));
    expect(same).toBe(c.duplicate);
  });

  it('never changes the stored display name', () => {
    const stored = mustName('Stra\u00DFe');
    workspaceNameKey(stored);
    expect(stored).toBe('Stra\u00DFe');
  });

  it('matches Unicode 18.0.0 CaseFolding.txt (C+F) for every non-Cc scalar value', () => {
    // 1,112,064 scalar values = 1,111,999 checked through the name API + 65 Cc values.
    // Cc values cannot be part of a valid name, so the key function is never applied to them.
    // The fixture maps none of them, so their folding is the identity either way.
    const expected = new Map<number, number[]>(casefold.mappings as [number, number[]][]);
    expect(expected.size).toBe(casefold.entryCount);
    const ccSet = new Set<number>(fixture.rules.controlCodePoints);
    expect(ccSet.size).toBe(65);
    expect([...expected.keys()].filter((cp) => ccSet.has(cp))).toEqual([]);
    const wrong: number[] = [];
    const skipped: number[] = [];
    let checked = 0;
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      // Use the key function through a name that passes validation: wrap in two safe letters.
      const r = validateWorkspaceName(`a${String.fromCodePoint(cp)}b`);
      if (!r.ok) {
        skipped.push(cp);
        continue;
      }
      checked++;
      const got = workspaceNameKey(r.value);
      const want = `a${String.fromCodePoint(...(expected.get(cp) ?? [cp]))}b`;
      if (got !== want) wrong.push(cp);
    }
    expect(wrong).toEqual([]);
    expect(skipped).toEqual([...ccSet].sort((a, b) => a - b));
    expect(checked).toBe(1_111_999);
    expect(checked + skipped.length).toBe(1_112_064);
  });
});
