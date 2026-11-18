import { err, ok, type Result } from './result';

// Place-value model for the first Computer Foundations bench: a row of bits read as a whole number from 0 upward.
// Nothing else: no arithmetic on patterns, no signed numbers, no hardware. Reference: the Binary Positional
// Representation lesson. Widths 1 to 8 are a choice of the bench, not a limit of binary.

export const PLACE_VALUE_MIN_WIDTH = 1;
export const PLACE_VALUE_MAX_WIDTH = 8;

export type Bit = 0 | 1;

declare const patternBrand: unique symbol;
/**
 * A valid pattern of 1 to 8 bits. `bits[p]` is the bit at Position `p`; Position 0 is the RIGHTMOST bit when
 * written. Obtain one only through functions in this module, so every pattern in circulation is valid.
 */
export type BitPattern = readonly Bit[] & { readonly [patternBrand]: true };

export type WidthError = 'invalid_width';
export type PositionError = 'invalid_position';
export type PatternError = WidthError | 'invalid_bit';

function isWidth(n: number): boolean {
  return Number.isInteger(n) && n >= PLACE_VALUE_MIN_WIDTH && n <= PLACE_VALUE_MAX_WIDTH;
}

function seal(bits: readonly Bit[]): BitPattern {
  return Object.freeze([...bits]) as unknown as BitPattern;
}

/** A pattern of `width` zeros. */
export function clearedPattern(width: number): Result<BitPattern, WidthError> {
  if (!isWidth(width)) return err('invalid_width');
  return ok(seal(Array.from({ length: width }, (): Bit => 0)));
}

/** Parses a pattern as written on paper, highest Position on the left ("1011"). Width is the text length. */
export function parsePattern(text: string): Result<BitPattern, PatternError> {
  if (!isWidth(text.length)) return err('invalid_width');
  const bits: Bit[] = [];
  for (const ch of text) {
    if (ch !== '0' && ch !== '1') return err('invalid_bit');
    bits.unshift(ch === '1' ? 1 : 0);
  }
  return ok(seal(bits));
}

/** The pattern as written on paper, highest Position on the left. */
export function formatPattern(pattern: BitPattern): string {
  return [...pattern].reverse().join('');
}

/** The Weight of a Position: 2 multiplied by itself `position` times. Position 0 has Weight 1. */
export function weightOf(position: number): Result<number, PositionError> {
  if (!Number.isInteger(position) || position < 0 || position >= PLACE_VALUE_MAX_WIDTH) return err('invalid_position');
  return ok(2 ** position);
}

/** What each Position adds to the Total: its Weight if the Bit is 1, otherwise 0. Indexed by Position. */
export function contributions(pattern: BitPattern): readonly number[] {
  return pattern.map((bit, position) => bit * 2 ** position);
}

/** The whole number the pattern is read as: the sum of the Contributions. */
export function total(pattern: BitPattern): number {
  return contributions(pattern).reduce((sum, c) => sum + c, 0);
}

/** A copy of the pattern with the Bit at `position` flipped. */
export function flipBit(pattern: BitPattern, position: number): Result<BitPattern, PositionError> {
  if (!Number.isInteger(position) || position < 0 || position >= pattern.length) return err('invalid_position');
  return ok(seal(pattern.map((bit, p): Bit => (p === position ? (bit === 0 ? 1 : 0) : bit))));
}

export interface FlipEffect {
  /** The Weight of the flipped Position. The size of the change depends only on this. */
  readonly weight: number;
  readonly newTotal: number;
  /** newTotal minus the current Total: +weight when a 0 becomes 1, -weight when a 1 becomes 0. */
  readonly change: number;
}

/** What flipping the Bit at `position` would do to the Total, without changing the pattern. */
export function flipEffect(pattern: BitPattern, position: number): Result<FlipEffect, PositionError> {
  const flipped = flipBit(pattern, position);
  if (!flipped.ok) return flipped;
  const newTotal = total(flipped.value);
  return ok({ weight: 2 ** position, newTotal, change: newTotal - total(pattern) });
}

/** Changes the width. Keeps the low Positions, drops high ones, pads new high Positions with 0. */
export function resizePattern(pattern: BitPattern, width: number): Result<BitPattern, WidthError> {
  if (!isWidth(width)) return err('invalid_width');
  return ok(seal(Array.from({ length: width }, (_, p): Bit => pattern[p] ?? 0)));
}

/** Whether resizing to `width` would drop at least one Bit that is 1. Raising the width never does. */
export function wouldDiscardActiveBits(pattern: BitPattern, width: number): Result<boolean, WidthError> {
  if (!isWidth(width)) return err('invalid_width');
  return ok(pattern.slice(width).includes(1));
}

/** How many different patterns `width` bits can make. */
export function patternCount(width: number): Result<number, WidthError> {
  if (!isWidth(width)) return err('invalid_width');
  return ok(2 ** width);
}

/** The largest Total `width` bits can make (every Bit 1). The smallest is always 0. */
export function maxTotal(width: number): Result<number, WidthError> {
  if (!isWidth(width)) return err('invalid_width');
  return ok(2 ** width - 1);
}
