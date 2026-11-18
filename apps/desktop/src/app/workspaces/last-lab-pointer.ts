import { Injectable, InjectionToken, inject } from '@angular/core';
import { parseWorkspaceId } from '@ele/domain';

/** The part of `Storage` the pointer uses. */
export type PointerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The versioned key. One value: the id of the last lab that opened. Not part of any lab record. */
export const POINTER_KEY = 'ele.lastLab.v1';

/** The webview's `localStorage`, or null where even touching it throws. Replaced in tests. */
export const LAST_LAB_STORAGE = new InjectionToken<PointerStorage | null>('LAST_LAB_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  },
});

/**
 * Remembers which lab was last opened, so launch can restore it. A convenience, never a source of
 * truth: every storage failure reads as "no pointer" and is ignored on write and clear, so it can
 * never block the application. Ids are checked with the domain's rule, not one of our own.
 */
@Injectable({ providedIn: 'root' })
export class LastLabPointer {
  private readonly storage = inject(LAST_LAB_STORAGE);

  /** A valid lab id, or null. A stored value that is not a valid id is cleared. */
  read(): string | null {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(POINTER_KEY) ?? null;
    } catch {
      return null;
    }
    if (raw === null) return null;
    if (parseWorkspaceId(raw).ok) return raw;
    this.clear();
    return null;
  }

  write(id: string): void {
    if (!parseWorkspaceId(id).ok) return;
    try {
      this.storage?.setItem(POINTER_KEY, id);
    } catch {
      /* a convenience only */
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(POINTER_KEY);
    } catch {
      /* a convenience only */
    }
  }
}
