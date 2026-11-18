import { describe, expect, it } from 'vitest';
import {
  PLACE_VALUE_MAX_WIDTH,
  PLACE_VALUE_MIN_WIDTH,
  clearedPattern,
  contributions,
  flipBit,
  flipEffect,
  formatPattern,
  maxTotal,
  parsePattern,
  patternCount,
  resizePattern,
  total,
  weightOf,
  wouldDiscardActiveBits,
  type BitPattern,
} from './place-value';

// Expected values below are literals (from the Binary Positional Representation lesson and its lab) or come from
// an independent reading (parseInt base 2, a plain loop). None is produced by the functions under test.

function pattern(text: string): BitPattern {
  const r = parsePattern(text);
  if (!r.ok) throw new Error(`test fixture ${text} did not parse: ${r.error}`);
  return r.value;
}

describe('limits', () => {
  it('supports widths 1 to 8', () => {
    expect([PLACE_VALUE_MIN_WIDTH, PLACE_VALUE_MAX_WIDTH]).toEqual([1, 8]);
  });
});

describe('the starting example 1011 at width 4', () => {
  const p = pattern('1011');

  it('has width 4 and is written back unchanged', () => {
    expect(p).toHaveLength(4);
    expect(formatPattern(p)).toBe('1011');
  });

  it('stores Position 0 first (the rightmost written bit)', () => {
    expect([...p]).toEqual([1, 1, 0, 1]);
  });

  it('contributes 1, 2, 0, 8 by Position', () => {
    expect(contributions(p)).toEqual([1, 2, 0, 8]);
  });

  it('has Total 11', () => {
    expect(total(p)).toBe(11);
  });
});

describe('weights', () => {
  it.each([
    [0, 1],
    [1, 2],
    [2, 4],
    [3, 8],
    [4, 16],
    [5, 32],
    [6, 64],
    [7, 128],
  ])('Position %i has Weight %i', (position, weight) => {
    expect(weightOf(position)).toEqual({ ok: true, value: weight });
  });

  it.each([-1, 8, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects Position %s', (position) => {
    expect(weightOf(position)).toEqual({ ok: false, error: 'invalid_position' });
  });
});

describe('totals from the lesson tables', () => {
  it.each([
    ['0001', 1],
    ['0010', 2],
    ['0100', 4],
    ['1000', 8],
    ['0101', 5],
    ['1010', 10],
    ['0111', 7],
    ['1111', 15],
    ['1001', 9],
    ['1100', 12],
    ['0110', 6],
    ['1101', 13],
    ['1110', 14],
    ['10000', 16],
    ['01111', 15],
    ['10010110', 150],
    ['11111111', 255],
  ])('%s has Total %i', (text, expected) => {
    expect(total(pattern(text))).toBe(expected);
  });

  it('gives 1000 the Total 8, not a thousand, with Contribution 8 + 0 + 0 + 0', () => {
    expect(contributions(pattern('1000'))).toEqual([0, 0, 0, 8]);
  });

  it('gives 0111 and 111 the same Total (a leading zero adds nothing)', () => {
    expect(total(pattern('0111'))).toBe(total(pattern('111'))); // both 7
    expect(total(pattern('111'))).toBe(7);
  });

  it('depends on which Positions hold the 1s, not how many', () => {
    expect(total(pattern('1000'))).toBe(8);
    expect(total(pattern('0001'))).toBe(1);
  });

  it('reads the 8-bit worked example as 128 + 16 + 4 + 2', () => {
    expect(contributions(pattern('10010110'))).toEqual([0, 2, 4, 0, 16, 0, 0, 128]);
  });
});

describe('boundaries', () => {
  it('width 1', () => {
    expect(total(pattern('0'))).toBe(0);
    expect(total(pattern('1'))).toBe(1);
    expect(maxTotal(1)).toEqual({ ok: true, value: 1 });
    expect(patternCount(1)).toEqual({ ok: true, value: 2 });
  });

  it('width 8', () => {
    expect(total(pattern('00000000'))).toBe(0);
    expect(total(pattern('11111111'))).toBe(255);
    expect(maxTotal(8)).toEqual({ ok: true, value: 255 });
    expect(patternCount(8)).toEqual({ ok: true, value: 256 });
  });

  it.each([
    [1, 2, 1],
    [2, 4, 3],
    [3, 8, 7],
    [4, 16, 15],
    [5, 32, 31],
    [6, 64, 63],
    [7, 128, 127],
    [8, 256, 255],
  ])('width %i makes %i patterns, largest Total %i', (width, count, largest) => {
    expect(patternCount(width)).toEqual({ ok: true, value: count });
    expect(maxTotal(width)).toEqual({ ok: true, value: largest });
  });

  it('all-zero and all-one patterns at every width', () => {
    for (let width = 1; width <= 8; width++) {
      const zeros = clearedPattern(width);
      expect(zeros.ok && total(zeros.value)).toBe(0);
      expect(zeros.ok && formatPattern(zeros.value)).toBe('0'.repeat(width));
      expect(total(pattern('1'.repeat(width)))).toBe(2 ** width - 1);
    }
  });

  it('agrees with an independent reading (parseInt base 2) for every pattern at every width', () => {
    for (let width = 1; width <= 8; width++) {
      for (let n = 0; n < 2 ** width; n++) {
        const text = n.toString(2).padStart(width, '0');
        expect(total(pattern(text))).toBe(Number.parseInt(text, 2));
      }
    }
  });
});

describe('flipping a Bit (lesson table: start at 1011)', () => {
  it.each([
    [0, '1010', 10, -1],
    [1, '1001', 9, -2],
    [2, '1111', 15, 4],
    [3, '0011', 3, -8],
  ])('flipping Position %i gives %s, Total %i, change %i', (position, text, newTotal, change) => {
    const start = pattern('1011');
    const flipped = flipBit(start, position);
    expect(flipped.ok && formatPattern(flipped.value)).toBe(text);
    expect(flipEffect(start, position)).toEqual({
      ok: true,
      value: { weight: 2 ** position, newTotal, change },
    });
  });

  it('does not change the original pattern', () => {
    const start = pattern('1011');
    flipBit(start, 2);
    expect(formatPattern(start)).toBe('1011');
    expect(total(start)).toBe(11);
  });

  it('flipping twice restores the pattern', () => {
    const once = flipBit(pattern('1011'), 3);
    const twice = once.ok ? flipBit(once.value, 3) : once;
    expect(twice.ok && formatPattern(twice.value)).toBe('1011');
  });

  it.each([-1, 4, 0.5, Number.NaN])('rejects Position %s at width 4', (position) => {
    expect(flipBit(pattern('1011'), position)).toEqual({ ok: false, error: 'invalid_position' });
    expect(flipEffect(pattern('1011'), position)).toEqual({ ok: false, error: 'invalid_position' });
  });

  it('accepts Position 7 only at width 8', () => {
    expect(flipBit(pattern('0000000'), 7)).toEqual({ ok: false, error: 'invalid_position' });
    const flipped = flipBit(pattern('00000000'), 7);
    expect(flipped.ok && formatPattern(flipped.value)).toBe('10000000');
  });
});

describe('resizing', () => {
  it('pads new high Positions with 0 when raising the width', () => {
    const r = resizePattern(pattern('1011'), 5);
    expect(r.ok && formatPattern(r.value)).toBe('01011');
    expect(r.ok && total(r.value)).toBe(11);
  });

  it('keeps the low Positions and drops the high ones when lowering', () => {
    const r = resizePattern(pattern('1011'), 2);
    expect(r.ok && formatPattern(r.value)).toBe('11');
  });

  it('keeps the same pattern at the same width', () => {
    const r = resizePattern(pattern('1011'), 4);
    expect(r.ok && formatPattern(r.value)).toBe('1011');
  });

  it('reaches both limits', () => {
    const wide = resizePattern(pattern('1'), 8);
    expect(wide.ok && formatPattern(wide.value)).toBe('00000001');
    const narrow = resizePattern(pattern('11111111'), 1);
    expect(narrow.ok && formatPattern(narrow.value)).toBe('1');
  });

  it.each([0, 9, -1, 2.5, Number.NaN])('rejects width %s', (width) => {
    expect(resizePattern(pattern('1011'), width)).toEqual({ ok: false, error: 'invalid_width' });
  });
});

describe('detecting active bits a smaller width would discard', () => {
  it.each([
    ['0011', 2, false], // drops Positions 3 and 2: 0, 0
    ['0111', 3, false], // drops Position 3: 0
    ['1011', 3, true], // drops Position 3: 1
    ['0100', 2, true], // drops Positions 3 and 2: 0, 1
    ['0100', 3, false], // drops Position 3: 0
    ['0001', 1, false], // drops Positions 3, 2, 1: all 0
    ['0010', 1, true], // drops Position 1: 1
  ])('%s to width %i discards active bits: %s', (text, width, expected) => {
    expect(wouldDiscardActiveBits(pattern(text), width)).toEqual({ ok: true, value: expected });
  });

  it('is false for the same width and for any raise', () => {
    expect(wouldDiscardActiveBits(pattern('1111'), 4)).toEqual({ ok: true, value: false });
    expect(wouldDiscardActiveBits(pattern('1111'), 8)).toEqual({ ok: true, value: false });
  });

  it('is true when only the top bit is active', () => {
    expect(wouldDiscardActiveBits(pattern('1000'), 3)).toEqual({ ok: true, value: true });
  });

  it('is false for an all-zero pattern at any smaller width', () => {
    expect(wouldDiscardActiveBits(pattern('0000'), 1)).toEqual({ ok: true, value: false });
  });

  it('rejects an unsupported width', () => {
    expect(wouldDiscardActiveBits(pattern('1011'), 0)).toEqual({ ok: false, error: 'invalid_width' });
    expect(wouldDiscardActiveBits(pattern('1011'), 9)).toEqual({ ok: false, error: 'invalid_width' });
  });
});

describe('invalid input cannot produce a misleading result', () => {
  it.each(['', '000000000', '10010110 '])('parsePattern rejects %j by width', (text) => {
    expect(parsePattern(text)).toEqual({ ok: false, error: 'invalid_width' });
  });

  it.each(['2', '10a1', ' 101', '1 01', '１０１', '-1'])('parsePattern rejects %j as an invalid bit', (text) => {
    expect(parsePattern(text)).toEqual({ ok: false, error: 'invalid_bit' });
  });

  it.each([0, 9, -1, 4.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects width %s everywhere', (width) => {
    const bad = { ok: false, error: 'invalid_width' };
    expect(clearedPattern(width)).toEqual(bad);
    expect(patternCount(width)).toEqual(bad);
    expect(maxTotal(width)).toEqual(bad);
  });

  it('returns a pattern that cannot be changed in place', () => {
    const p = pattern('1011');
    expect(() => {
      (p as unknown as number[])[0] = 0;
    }).toThrow();
    expect(total(p)).toBe(11);
  });
});
