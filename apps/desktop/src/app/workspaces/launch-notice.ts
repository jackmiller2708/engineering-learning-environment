import { Injectable } from '@angular/core';
import type { LaunchOutcome } from './describe-error';

/**
 * Hands what happened to the remembered lab, from launch to the Worlds screen, exactly once. In memory
 * only: it is not the last-lab pointer and survives nothing, so the notice cannot return on a later visit.
 */
@Injectable({ providedIn: 'root' })
export class LaunchNotice {
  private outcome: LaunchOutcome | null = null;

  set(outcome: LaunchOutcome): void {
    this.outcome = outcome;
  }

  /** Returns the outcome and forgets it. */
  take(): LaunchOutcome | null {
    const o = this.outcome;
    this.outcome = null;
    return o;
  }
}
