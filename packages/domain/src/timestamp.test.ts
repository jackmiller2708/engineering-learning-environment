import { describe, expect, it } from 'vitest';
import {
  MAX_TIMESTAMP,
  MIN_TIMESTAMP,
  formatTimestamp,
  parseTimestamp,
} from './timestamp';

const at = (iso: string) => new Date(iso);

describe('supported range', () => {
  it('is 1970-01-01T00:00:00Z to 9999-12-31T23:59:59Z', () => {
    expect(MIN_TIMESTAMP).toBe('1970-01-01T00:00:00Z');
    expect(MAX_TIMESTAMP).toBe('9999-12-31T23:59:59Z');
  });
});

describe('formatTimestamp', () => {
  it.each([
    ['the Unix epoch', at('1970-01-01T00:00:00Z'), '1970-01-01T00:00:00Z'],
    ['zero-pads every field', at('2026-01-02T03:04:05Z'), '2026-01-02T03:04:05Z'],
    ['an ordinary instant', new Date(Date.UTC(2026, 10, 17, 7, 5, 9)), '2026-11-17T07:05:09Z'],
    ['a leap day', at('2024-02-29T12:00:00Z'), '2024-02-29T12:00:00Z'],
    ['the last supported second', at('9999-12-31T23:59:59Z'), '9999-12-31T23:59:59Z'],
  ])('formats %s', (_label, date, expected) => {
    expect(formatTimestamp(date)).toEqual({ ok: true, value: expected });
  });

  it('drops milliseconds by flooring to the whole second', () => {
    expect(formatTimestamp(at('2026-11-17T07:05:09.999Z'))).toEqual({ ok: true, value: '2026-11-17T07:05:09Z' });
  });

  it('ignores the machine time zone (uses UTC fields)', () => {
    // Same instant expressed with an offset; the result is always UTC.
    expect(formatTimestamp(at('2026-11-17T14:05:09+07:00'))).toEqual({ ok: true, value: '2026-11-17T07:05:09Z' });
  });

  it('rejects an invalid Date', () => {
    expect(formatTimestamp(new Date(Number.NaN))).toEqual({ ok: false, error: 'invalid_timestamp' });
  });

  it.each([
    ['one millisecond before the epoch', at('1969-12-31T23:59:59.999Z')],
    ['year 10000', at('+010000-01-01T00:00:00Z')],
    ['the Date range limit', new Date(8.64e15)],
  ])('rejects %s as out of range', (_label, date) => {
    expect(formatTimestamp(date)).toEqual({ ok: false, error: 'timestamp_out_of_range' });
  });
});

describe('parseTimestamp', () => {
  it.each(['1970-01-01T00:00:00Z', '2000-02-29T23:59:59Z', '2024-02-29T00:00:00Z', '9999-12-31T23:59:59Z'])(
    'accepts %s',
    (text) => {
      expect(parseTimestamp(text)).toEqual({ ok: true, value: text });
    },
  );

  it.each([
    ['lowercase t', '2026-11-17t07:05:09Z'],
    ['lowercase z', '2026-11-17T07:05:09z'],
    ['space separator', '2026-11-17 07:05:09Z'],
    ['numeric offset', '2026-11-17T07:05:09+00:00'],
    ['fractional seconds', '2026-11-17T07:05:09.000Z'],
    ['missing Z', '2026-11-17T07:05:09'],
    ['date only', '2026-11-17'],
    ['single-digit month', '2026-1-17T07:05:09Z'],
    ['leading space', ' 2026-11-17T07:05:09Z'],
    ['trailing newline', '2026-11-17T07:05:09Z\n'],
    ['Arabic-Indic digits', '\u0662\u0660\u0662\u0666-11-17T07:05:09Z'],
    ['empty', ''],
    ['non-leap Feb 29', '2026-02-29T00:00:00Z'],
    ['century non-leap Feb 29', '2100-02-29T00:00:00Z'],
    ['Feb 30', '2024-02-30T00:00:00Z'],
    ['April 31', '2026-04-31T00:00:00Z'],
    ['month 13', '2026-13-01T00:00:00Z'],
    ['month 0', '2026-00-10T00:00:00Z'],
    ['day 0', '2026-01-00T00:00:00Z'],
    ['hour 24', '2026-11-17T24:00:00Z'],
    ['minute 60', '2026-11-17T23:60:00Z'],
    ['leap second 60', '2026-11-17T23:59:60Z'],
    ['invalid date in year 0', '0000-02-30T00:00:00Z'],
  ])('rejects %s as invalid', (_label, text) => {
    expect(parseTimestamp(text)).toEqual({ ok: false, error: 'invalid_timestamp' });
  });

  it.each([
    ['one second before the epoch', '1969-12-31T23:59:59Z'],
    ['year 0', '0000-01-01T00:00:00Z'],
  ])('rejects %s as out of range', (_label, text) => {
    expect(parseTimestamp(text)).toEqual({ ok: false, error: 'timestamp_out_of_range' });
  });

  it('accepts exactly what formatTimestamp produces', () => {
    for (const iso of ['1970-01-01T00:00:00Z', '2026-11-17T07:05:09Z', '9999-12-31T23:59:59Z']) {
      const formatted = formatTimestamp(at(iso));
      expect(formatted.ok && parseTimestamp(formatted.value)).toEqual(formatted);
    }
  });
});
