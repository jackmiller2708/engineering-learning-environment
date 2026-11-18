import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { describeError } from './describe-error';
import { sortLabsNewestFirst } from './lab-order';
import { formatCreated, formatCreatedLocal, localOffsetLabel, shortId } from './workspace-format';
import type { WorkspaceDto, WorkspaceEntryDto } from './workspace-gateway';

/** The valid labs, newest first, then the entries the application cannot open (LE-017, LE-020). */
@Component({
  selector: 'app-lab-list',
  imports: [RouterLink],
  templateUrl: './lab-list.html',
  styleUrl: './lab-list.css',
})
export class LabList {
  readonly entries = input.required<readonly WorkspaceEntryDto[]>();
  /** The lab just created, which carries the "New" tag. */
  readonly newId = input<string | null>(null);
  /** The learner asked to read an unreadable entry again. */
  readonly retry = output<void>();

  protected readonly sorted = computed(() => sortLabsNewestFirst(this.entries()));
  protected readonly labs = computed(() => this.sorted().filter((e): e is WorkspaceDto & { status: 'valid' } => e.status === 'valid'));
  protected readonly unopenable = computed(() => this.sorted().flatMap((e) => (e.status === 'invalid' ? [e] : [])));
  /** The machine's offset, for the column header. The times themselves follow the date of each lab. */
  protected readonly offset = localOffsetLabel();
  protected readonly shortId = shortId;
  protected readonly utc = formatCreated;
  protected readonly reason = (kind: string) => describeError(kind, { where: 'entry' });

  /** Local time, or the stored UTC text if the webview cannot format it (it should not happen). */
  protected local(createdAt: string): string {
    return formatCreatedLocal(createdAt) || formatCreated(createdAt) || createdAt;
  }
}
