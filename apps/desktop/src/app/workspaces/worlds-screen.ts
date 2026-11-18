import { Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LabCreateForm } from './lab-create-form';
import { LabList } from './lab-list';
import { describeError, describeLaunchOutcome } from './describe-error';
import { LaunchNotice } from './launch-notice';
import { WORKSPACE_GATEWAY, type WorkspaceDto, type WorkspaceEntryDto } from './workspace-gateway';

type ListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly message: string }
  | { readonly kind: 'ready'; readonly entries: readonly WorkspaceEntryDto[] };

/**
 * `/worlds`: the World and its labs. Showing the World opens no lab and creates none (owner decision):
 * a lab opens only when the learner activates a row, and is created only by "Create new lab".
 * The host owns all validation. Host `message` text is never shown, only `describeError`.
 */
@Component({
  selector: 'app-worlds-screen',
  imports: [RouterLink, LabCreateForm, LabList],
  templateUrl: './worlds-screen.html',
  styleUrl: './worlds-screen.css',
})
export class WorldsScreen {
  private readonly gateway = inject(WORKSPACE_GATEWAY);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly labsHeading = viewChild<ElementRef<HTMLElement>>('labsHeading');
  private readonly retryButton = viewChild<ElementRef<HTMLElement>>('retryButton');
  private loadSeq = 0;
  /** Set by Try again. The next settled list may take focus, but only if focus was lost with the button. */
  private focusAfterRetry = false;

  /** What happened to the remembered lab at launch, if it could not be restored. Handed over once. */
  private readonly launch = inject(LaunchNotice).take();
  protected readonly notice = this.launch && this.launch.kind !== 'list-failed' ? describeLaunchOutcome(this.launch) : null;
  /** The lead line of the list-failure panel: after a failed launch check it is the owner's N-1 wording. */
  private readonly panelTitle =
    this.launch?.kind === 'list-failed' ? describeLaunchOutcome(this.launch).title : 'Your labs could not be loaded.';

  protected readonly list = signal<ListState>({ kind: 'loading' });
  protected readonly newId = signal<string | null>(null);

  constructor() {
    // Arriving here is a page change: put focus on the new page's heading.
    effect(() => this.heading()?.nativeElement.focus());
    // After Try again the panel and its button leave the page while the list loads, which drops focus on the page.
    // Once the list settles, put it on the Labs heading (or the Try again button if the retry failed). If the learner
    // has put focus anywhere else meanwhile, leave it alone.
    effect(() => {
      const state = this.list();
      const button = this.retryButton();
      // Ready: wait until the failure panel (and so its button) has actually left the page, or focus would still be on it.
      const target = state.kind === 'ready' ? (button ? undefined : this.labsHeading()) : state.kind === 'failed' ? button : undefined;
      if (!target) return;
      untracked(() => {
        if (!this.focusAfterRetry) return;
        this.focusAfterRetry = false;
        const active = document.activeElement;
        if (!active || active === document.body) target.nativeElement.focus();
      });
    });
    void this.load(true);
  }

  protected labCount(entries: readonly WorkspaceEntryDto[]): number {
    return entries.filter((e) => e.status === 'valid').length;
  }

  protected title(): string {
    return this.panelTitle;
  }

  protected retry(): void {
    this.focusAfterRetry = true;
    void this.load(true);
  }

  protected onCreated(lab: WorkspaceDto): void {
    this.newId.set(lab.id);
    void this.load(false);
  }

  protected onUnconfirmed(): void {
    void this.load(false);
  }

  /** `showLoading` is false when refreshing behind a visible list. Only the newest request may write. */
  private async load(showLoading: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    if (showLoading) this.list.set({ kind: 'loading' });
    const result = await this.gateway.listWorkspaces();
    if (seq !== this.loadSeq) return;
    this.list.set(
      result.ok
        ? { kind: 'ready', entries: result.value.entries }
        : { kind: 'failed', message: describeError(result.error.kind, { where: 'list' }) },
    );
  }
}
