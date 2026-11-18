import { parseTimestamp } from '@ele/domain';

/** `2026-11-17T07:05:09Z` -> `2026-11-17 07:05 UTC`. The host's UTC text, shown as stored. */
export function formatCreated(createdAt: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/.exec(createdAt);
  return match ? `${match[1]} ${match[2]} UTC` : '';
}

/** The first group of a UUID, enough to tell two workspaces with the same name apart. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * The stored UTC time shown in the machine's time zone, as `2026-11-17 14:05`. Daylight saving follows
 * the date of the lab, not today. Returns '' for a value that is not a canonical time. `timeZone` exists
 * for tests and defaults to the machine's. The seconds are dropped, as in `formatCreated`.
 */
export function formatCreatedLocal(createdAt: string, timeZone?: string): string {
  if (!parseTimestamp(createdAt).ok) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(createdAt));
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}`;
}

/** The machine's offset from UTC at an instant, for a column header: `GMT+7`, `GMT-5`, `GMT+5:30`, `GMT`. */
export function localOffsetLabel(at: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at).find((x) => x.type === 'timeZoneName')?.value ?? '';
}
