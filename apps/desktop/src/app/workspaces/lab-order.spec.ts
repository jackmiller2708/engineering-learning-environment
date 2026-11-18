import { MAX_TIMESTAMP, MIN_TIMESTAMP, formatTimestamp, parseTimestamp } from '@ele/domain';
import { ID_A, ID_B, ID_C, invalid, valid } from './fake-gateway.testing';
import { sortLabsNewestFirst } from './lab-order';

describe('sortLabsNewestFirst', () => {
  const old = valid(ID_A, 'Old', '2026-01-02T03:04:05Z');
  const mid = valid(ID_B, 'Mid', '2026-06-02T03:04:05Z');
  const recent = valid(ID_C, 'Recent', '2026-11-17T07:05:09Z');

  it('puts the newest created lab first', () => {
    expect(sortLabsNewestFirst([old, recent, mid]).map((e) => (e.status === 'valid' ? e.name : e.id))).toEqual(['Recent', 'Mid', 'Old']);
  });

  it('breaks a tie on the same second by id, ascending, so the order is fixed', () => {
    const t = '2026-11-17T07:05:09Z';
    const x = valid(ID_C, 'X', t);
    const y = valid(ID_A, 'Y', t);
    const z = valid(ID_B, 'Z', t);
    expect(sortLabsNewestFirst([x, y, z]).map((e) => e.id)).toEqual([ID_A, ID_B, ID_C]);
    expect(sortLabsNewestFirst([z, x, y]).map((e) => e.id)).toEqual([ID_A, ID_B, ID_C]);
  });

  it('gives the same order whatever order the host sent', () => {
    const all = [old, mid, recent, valid('00000000-0000-4000-8000-000000000000', 'Twin', '2026-11-17T07:05:09Z')];
    const expected = sortLabsNewestFirst(all).map((e) => e.id);
    expect(sortLabsNewestFirst([...all].reverse()).map((e) => e.id)).toEqual(expected);
    expect(sortLabsNewestFirst([all[2]!, all[0]!, all[3]!, all[1]!]).map((e) => e.id)).toEqual(expected);
  });

  it('keeps unopenable entries in the result (LE-020), after the labs that have a time, by id ascending', () => {
    const bad1 = invalid('00000000-0000-4000-8000-000000000001', 'entry_unreadable');
    const bad2 = invalid('00000000-0000-4000-8000-000000000002');
    const out = sortLabsNewestFirst([bad2, old, bad1, recent]);
    expect(out).toEqual([recent, old, bad1, bad2]);
  });

  it('never drops an entry', () => {
    const input = [invalid(ID_C), old, invalid(ID_B), recent, mid];
    expect(sortLabsNewestFirst(input)).toHaveLength(input.length);
  });

  it('does not change its input', () => {
    const input = [old, recent, mid];
    sortLabsNewestFirst(input);
    expect(input).toEqual([old, recent, mid]);
  });

  it('returns nothing for nothing', () => {
    expect(sortLabsNewestFirst([])).toEqual([]);
  });

  it('returns the entries as they are, so the caller can still tell valid from unopenable', () => {
    const bad = invalid(ID_B);
    expect(sortLabsNewestFirst([bad, old])).toEqual([old, bad]);
  });
});

// The sort compares createdAt as text. That is only correct while every valid entry holds a
// fixed-width canonical UTC time. These tests record that assumption, so a change to the format
// (in the domain or the host) fails here instead of silently mis-ordering the list.
describe('the createdAt ordering assumption', () => {
  it('holds at both ends of the supported range', () => {
    expect(MIN_TIMESTAMP < MAX_TIMESTAMP).toBe(true);
    expect(MIN_TIMESTAMP.length).toBe(20);
    expect(MAX_TIMESTAMP.length).toBe(20);
  });

  it('makes text order equal chronological order for formatted instants', () => {
    let seed = 12345; // a fixed seed, so a failure is reproducible
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const lo = Date.UTC(1970, 0, 1);
    const hi = Date.UTC(9999, 11, 31, 23, 59, 59);
    const instants = [lo, hi, ...Array.from({ length: 2000 }, () => Math.floor(lo + next() * (hi - lo)))];
    const stamps = instants.map((ms) => {
      const r = formatTimestamp(new Date(ms));
      if (!r.ok) throw new Error(`cannot format ${ms}`);
      return { ms: Math.floor(ms / 1000) * 1000, text: r.value };
    });
    expect(stamps.every((s) => s.text.length === 20)).toBe(true);
    const byText = [...stamps].sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0)).map((s) => s.ms);
    const byTime = [...stamps].sort((a, b) => a.ms - b.ms).map((s) => s.ms);
    expect(byText).toEqual(byTime);
  });

  it('is protected by the domain parser, which accepts only the fixed-width form', () => {
    expect(parseTimestamp('2026-11-17T07:05:09Z').ok).toBe(true);
    for (const bad of ['2026-1-2T3:04:05Z', '2026-11-17T07:05:09.5Z', '2026-11-17T07:05:09+07:00', '2026-11-17 07:05:09Z', '26-11-17T07:05:09Z', '2026-11-17t07:05:09z'])
      expect(parseTimestamp(bad).ok, bad).toBe(false);
  });
});
