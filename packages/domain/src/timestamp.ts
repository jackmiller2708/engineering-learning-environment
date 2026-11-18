import { err, ok, type Result } from './result';

declare const timestampBrand: unique symbol;
/** A canonical UTC timestamp `YYYY-MM-DDTHH:MM:SSZ`, whole seconds, years 1970..9999. */
export type Timestamp = string & { readonly [timestampBrand]: true };

export type TimestampError = 'invalid_timestamp' | 'timestamp_out_of_range';

/** Supported range: Unix epoch to the last second of year 9999 (four-digit years only). */
export const MIN_TIMESTAMP = '1970-01-01T00:00:00Z' as Timestamp;
export const MAX_TIMESTAMP = '9999-12-31T23:59:59Z' as Timestamp;

const MIN_YEAR = 1970;
const MAX_YEAR = 9999;

// `\d` without the `u` flag matches ASCII 0-9 only.
const CANONICAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** Checks calendar validity (proleptic Gregorian) and the supported year range. */
function check(y: number, mo: number, d: number, h: number, mi: number, s: number): TimestampError | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) {
    return 'invalid_timestamp';
  }
  return y < MIN_YEAR || y > MAX_YEAR ? 'timestamp_out_of_range' : undefined;
}

/**
 * Formats a caller-supplied instant in UTC. Milliseconds are dropped by flooring to the whole second.
 * Uses only UTC fields: no time zone, no locale. The domain never reads the clock; the caller passes the Date.
 */
export function formatTimestamp(date: Date): Result<Timestamp, TimestampError> {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return err('invalid_timestamp');
  const whole = new Date(Math.floor(ms / 1000) * 1000);
  const y = whole.getUTCFullYear();
  const mo = whole.getUTCMonth() + 1;
  const d = whole.getUTCDate();
  const h = whole.getUTCHours();
  const mi = whole.getUTCMinutes();
  const s = whole.getUTCSeconds();
  const problem = y < MIN_YEAR || y > MAX_YEAR ? 'timestamp_out_of_range' : check(y, mo, d, h, mi, s);
  if (problem) return err(problem);
  return ok(`${pad(y, 4)}-${pad(mo, 2)}-${pad(d, 2)}T${pad(h, 2)}:${pad(mi, 2)}:${pad(s, 2)}Z` as Timestamp);
}

/** Accepts exactly the canonical text. Never repairs: no offsets, fractions, lowercase or whitespace. */
export function parseTimestamp(text: string): Result<Timestamp, TimestampError> {
  const m = CANONICAL.exec(text);
  if (!m) return err('invalid_timestamp');
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const problem = check(y, mo, d, h, mi, s);
  return problem ? err(problem) : ok(text as Timestamp);
}
