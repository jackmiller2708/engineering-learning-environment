import { formatCreated, formatCreatedLocal, localOffsetLabel, shortId } from './workspace-format';

describe('workspace display formatting', () => {
  it('shows the stored UTC time without locale or time-zone conversion', () => {
    expect(formatCreated('2026-11-17T07:05:09Z')).toBe('2026-11-17 07:05 UTC');
    expect(formatCreated('1970-01-01T00:00:00Z')).toBe('1970-01-01 00:00 UTC');
    expect(formatCreated('9999-12-31T23:59:59Z')).toBe('9999-12-31 23:59 UTC');
  });

  it('shortens an id to its first group', () => {
    expect(shortId('4f525f09-3c12-449f-872b-c148c25e63ba')).toBe('4f525f09');
  });

  it('never fails on a value that is not the expected shape', () => {
    expect(formatCreated('')).toBe('');
    expect(shortId('x')).toBe('x');
  });
});

describe('local time display', () => {
  const at = '2026-11-17T07:05:09Z';

  it.each([
    ['Asia/Ho_Chi_Minh', '2026-11-17 14:05'],
    ['America/New_York', '2026-11-17 02:05'],
    ['UTC', '2026-11-17 07:05'],
    ['Asia/Kolkata', '2026-11-17 12:35'],
  ])('shows the stored time in %s', (zone, expected) => {
    expect(formatCreatedLocal(at, zone)).toBe(expected);
  });

  it('moves the date when the zone is on the other side of midnight', () => {
    expect(formatCreatedLocal('2026-11-17T23:30:00Z', 'Asia/Tokyo')).toBe('2026-11-18 08:30');
    expect(formatCreatedLocal('1970-01-01T00:00:00Z', 'America/Los_Angeles')).toBe('1969-12-31 16:00');
  });

  it('follows daylight saving for that date, not for today', () => {
    expect(formatCreatedLocal('2026-07-01T12:00:00Z', 'America/New_York')).toBe('2026-07-01 08:00');
    expect(formatCreatedLocal('2026-01-01T12:00:00Z', 'America/New_York')).toBe('2026-01-01 07:00');
  });

  it('shows midnight as 00:00, never 24:00', () => {
    expect(formatCreatedLocal('2026-11-17T17:00:00Z', 'Asia/Ho_Chi_Minh')).toBe('2026-11-18 00:00');
  });

  it('never fails on a value that is not a canonical time', () => {
    for (const bad of ['', 'x', '2026-11-17 07:05:09', '2026-11-17T07:05:09+07:00', '2026-13-45T99:99:99Z']) expect(formatCreatedLocal(bad, 'UTC')).toBe('');
  });

  it('states the offset for a column header', () => {
    const when = new Date('2026-11-17T07:05:09Z');
    expect(localOffsetLabel(when, 'Asia/Ho_Chi_Minh')).toBe('GMT+7');
    expect(localOffsetLabel(when, 'America/New_York')).toBe('GMT-5');
    expect(localOffsetLabel(when, 'Asia/Kolkata')).toBe('GMT+5:30');
    // Engines differ for a zero offset ('GMT' or 'GMT+0'). Both are acceptable in a header.
    expect(localOffsetLabel(when, 'UTC')).toMatch(/^GMT(\+0)?$/);
  });

  it('uses the machine zone when none is given, and keeps UTC available separately', () => {
    expect(formatCreatedLocal(at)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(formatCreated(at)).toBe('2026-11-17 07:05 UTC');
  });
});
