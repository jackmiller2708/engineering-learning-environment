import { Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StatusMessage } from '../status-message';
import { LastLabPointer } from './last-lab-pointer';
import { LaunchNotice } from './launch-notice';
import { shortId } from './workspace-format';
import { WORKSPACE_GATEWAY } from './workspace-gateway';

/**
 * Host kinds that confirm a lab can never be opened as it is, so a pointer to it is useless.
 * Anything else (including `entry_unreadable` and kinds this build does not know) is not
 * confirmed, and the pointer is kept.
 */
export const DEFINITIVE_KINDS: ReadonlySet<string> = new Set([
  'entry_symlink',
  'manifest_missing',
  'manifest_not_a_file',
  'manifest_too_large',
  'manifest_not_utf8',
  'manifest_malformed',
  'manifest_invalid_field',
  'manifest_id_mismatch',
  'manifest_unsupported_version',
]);

/**
 * `/` is not a screen. It decides once per launch where to start, then replaces itself in history
 * so Back never returns here. A lab is restored only when the host confirms it is present and
 * valid. In every other case the learner lands on Worlds.
 */
@Component({
  selector: 'app-launch-resolver',
  // No region of its own: "Opening your last lab…" is written into the shell's one status region.
  template: `<main aria-busy="true"></main>`,
})
export class LaunchResolver {
  private readonly router = inject(Router);
  private readonly gateway = inject(WORKSPACE_GATEWAY);
  private readonly pointer = inject(LastLabPointer);
  private readonly notice = inject(LaunchNotice);
  private readonly status = inject(StatusMessage).text;

  constructor() {
    this.status.set('Opening your last lab…');
    // Every way out navigates away, which destroys this screen. That is what clears the text, on completion, failure and early exit alike.
    inject(DestroyRef).onDestroy(() => this.status.set(''));
    void this.decide();
  }

  private async decide(): Promise<void> {
    const id = this.pointer.read();
    if (id === null) return this.go('/worlds');
    const result = await this.gateway.listWorkspaces();
    if (!result.ok) {
      this.notice.set({ kind: 'list-failed' });
      return this.go('/worlds'); // not confirmed either way: keep the pointer
    }
    const entry = result.value.entries.find((e) => e.id === id);
    if (!entry) {
      this.pointer.clear();
      this.notice.set({ kind: 'absent' });
    } else if (entry.status === 'invalid') {
      if (DEFINITIVE_KINDS.has(entry.kind)) this.pointer.clear();
      this.notice.set({ kind: 'invalid', shortId: shortId(entry.id), entryKind: entry.kind });
    } else return this.go('/workspace', id);
    return this.go('/worlds');
  }

  private go(...commands: string[]): void {
    void this.router.navigate(commands, { replaceUrl: true });
  }
}
