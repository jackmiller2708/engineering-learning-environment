import { Injectable, signal } from '@angular/core';

/** The lab the learner is in, once the host has confirmed it. Set by the lab screen, read by the shell's breadcrumb. */
@Injectable({ providedIn: 'root' })
export class ActiveLab {
  readonly lab = signal<{ readonly id: string; readonly name: string } | null>(null);
}
