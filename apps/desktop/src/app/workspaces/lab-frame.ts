import { Component, DestroyRef, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { parseWorkspaceId } from '@ele/domain';
import { ActiveLab } from '../active-lab';
import { pageTitle } from '../page-title';
import { StatusMessage } from '../status-message';
import { WORLD_NAME } from '../world';
import { describeLabState, type LabState } from './describe-error';
import { LastLabPointer } from './last-lab-pointer';
import { formatCreated, formatCreatedLocal, localOffsetLabel } from './workspace-format';
import { WORKSPACE_GATEWAY, type WorkspaceDto } from './workspace-gateway';

type View =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly workspace: WorkspaceDto }
  | { readonly kind: 'problem'; readonly state: LabState };

/**
 * One lab. The address is the identity: `/workspace/:id` (the internal name is kept). The id is validated,
 * then looked up in the host's list. Nothing is shown as open unless the host confirms it. The bench is not
 * built yet: the frame shows the lab's real facts and says so. Host `message` text is never shown.
 */
@Component({
  selector: 'app-lab-frame',
  imports: [RouterLink],
  templateUrl: './lab-frame.html',
  styleUrl: './lab-frame.css',
})
export class LabFrame {
  private readonly gateway = inject(WORKSPACE_GATEWAY);
  private readonly pointer = inject(LastLabPointer);
  private readonly activeLab = inject(ActiveLab);
  private readonly status = inject(StatusMessage).text;
  private readonly title = inject(Title);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private resolveSeq = 0;
  /**
   * Whether the next settled state should take focus. Arriving on a route always does. After Try again
   * it does only if focus was lost with the button, so a retry never takes focus from where the learner put it.
   */
  private focusMode: 'arrival' | 'retry' | null = null;

  /** Bound from the route parameter. */
  readonly id = input.required<string>();
  protected readonly view = signal<View>({ kind: 'loading' });
  protected readonly world = WORLD_NAME;
  protected readonly describe = describeLabState;
  protected readonly utc = formatCreated;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.resolve(id, 'arrival'));
    });
    // Focus the new state's heading once it exists, and only once per resolution.
    effect(() => {
      const view = this.view();
      const heading = this.heading();
      if (view.kind === 'loading' || !heading) return;
      untracked(() => {
        const mode = this.focusMode;
        this.focusMode = null;
        if (mode === 'arrival' || (mode === 'retry' && (!document.activeElement || document.activeElement === document.body)))
          heading.nativeElement.focus();
      });
    });
    // The shell's breadcrumb names the lab only while it is confirmed open.
    effect(() => {
      const v = this.view();
      this.activeLab.lab.set(v.kind === 'ready' ? { id: v.workspace.id, name: v.workspace.name } : null);
    });
    // The shell's status region says "Opening lab…" only while this screen is loading.
    effect(() => this.status.set(this.view().kind === 'loading' ? 'Opening lab…' : ''));
    inject(DestroyRef).onDestroy(() => {
      this.activeLab.lab.set(null);
      this.status.set(''); // leaving while still loading must not leave the message behind
      this.resolveSeq++; // a result still pending for this screen must change nothing after it is gone
    });
  }

  protected retry(): void {
    void this.resolve(this.id(), 'retry');
  }

  /** `2026-11-17 14:05 (GMT+7)`: the stored time in this machine's zone, with the offset in force on that date. */
  protected created(createdAt: string): string {
    const local = formatCreatedLocal(createdAt);
    if (!local) return formatCreated(createdAt) || createdAt; // not a canonical time: show it as stored
    const offset = localOffsetLabel(new Date(createdAt));
    return offset ? `${local} (${offset})` : local;
  }

  /** A problem state, with its heading as the page title (the same words the screen shows). */
  private problem(state: LabState): void {
    this.view.set({ kind: 'problem', state });
    this.title.setTitle(pageTitle(describeLabState(state).heading));
  }

  private async resolve(id: string, mode: 'arrival' | 'retry'): Promise<void> {
    const seq = ++this.resolveSeq;
    this.focusMode = mode;
    // Arriving shows the generic title, never a previous lab's name. A retry keeps the error title until it resolves.
    if (mode === 'arrival') this.title.setTitle(pageTitle());
    if (!parseWorkspaceId(id).ok) {
      this.problem({ kind: 'bad-address' });
      return;
    }
    this.view.set({ kind: 'loading' });
    const result = await this.gateway.listWorkspaces();
    if (seq !== this.resolveSeq) return; // the address changed while waiting
    if (!result.ok) {
      this.problem({ kind: 'failed', listKind: result.error.kind });
      return;
    }
    const entry = result.value.entries.find((e) => e.id === id);
    if (!entry) this.problem({ kind: 'not-found' });
    else if (entry.status === 'invalid') this.problem({ kind: 'unopenable', entryKind: entry.kind });
    else {
      this.view.set({ kind: 'ready', workspace: { id: entry.id, name: entry.name, createdAt: entry.createdAt } });
      this.title.setTitle(pageTitle(entry.name, WORLD_NAME));
      this.pointer.write(entry.id); // only after the lab has actually opened
    }
  }
}
