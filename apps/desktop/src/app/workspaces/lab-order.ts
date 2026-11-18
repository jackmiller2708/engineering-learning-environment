import type { WorkspaceEntryDto } from './workspace-gateway';

/**
 * Every entry, in display order (LE-017, LE-020). Nothing is removed: whether an entry is interactive is
 * the screen's concern. Valid labs come first, newest created first, equal times by id ascending.
 * Unopenable entries have no creation time, so they follow the labs, by id ascending.
 *
 * Times are compared as text. That is correct only because every valid entry holds a fixed-width
 * canonical UTC time (`YYYY-MM-DDTHH:MM:SSZ`), which the domain parser and the host both enforce.
 * `lab-order.spec.ts` records that assumption.
 */
export function sortLabsNewestFirst(entries: readonly WorkspaceEntryDto[]): WorkspaceEntryDto[] {
  const byId = (a: WorkspaceEntryDto, b: WorkspaceEntryDto) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return [...entries].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'valid' ? -1 : 1;
    if (a.status === 'valid' && b.status === 'valid' && a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return byId(a, b);
  });
}
