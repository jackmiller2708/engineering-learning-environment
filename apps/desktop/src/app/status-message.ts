import { Injectable, signal } from '@angular/core';

/**
 * The text of the shell's one polite status region. The shell renders the region before any screen exists,
 * so a screen only changes its text, which is what a live region announces. In memory only.
 */
@Injectable({ providedIn: 'root' })
export class StatusMessage {
  readonly text = signal('');
}
