import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { contributions, flipBit, flipEffect, parsePattern, total, weightOf, type Bit, type BitPattern } from '@ele/domain';

/** The Bench opens on this pattern every time (it is not saved). Width 4 is the default. */
const STARTING_PATTERN = '1011';

function starting(): BitPattern {
  const r = parsePattern(STARTING_PATTERN);
  if (!r.ok) throw new Error(`starting pattern ${STARTING_PATTERN} is invalid: ${r.error}`);
  return r.value;
}

/** A signed change as written for the learner: +4, −8, 0. */
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** A signed whole number as typed ("+4", "-8", "4", or with a real minus sign), or null. Input handling only. */
function parseSigned(text: string): number | null {
  const t = text.trim().replace('−', '-');
  if (!/^[+-]?\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  return n === 0 ? 0 : n; // no negative zero
}

/** A locked prediction: the Position and signed change are fixed. */
interface Locked {
  readonly position: number;
  readonly change: number;
}

/** A locked prediction after its Position was flipped. */
interface Revealed {
  readonly position: number;
  readonly predicted: number;
  readonly actual: number;
  readonly weight: number;
  readonly from: Bit;
  readonly to: Bit;
}

const EASE_OUT = 'cubic-bezier(.165, .84, .44, 1)';

/**
 * The place-value bench: one switch per Bit, each Position's Weight and Contribution, the Total, an Inspector and an
 * optional Prediction. All place-value arithmetic is in `@ele/domain`. State is local and lasts as long as this
 * component, so reopening a Lab starts again. Nothing here is saved.
 */
@Component({
  selector: 'app-place-value-bench',
  templateUrl: './place-value-bench.html',
  styleUrl: './place-value-bench.css',
})
export class PlaceValueBench {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly pattern = signal<BitPattern>(starting());
  /** The inspected Position, or null. Selecting never changes the pattern. */
  protected readonly selected = signal<number | null>(null);
  /** Set by the first Bit change and never cleared, so "Starting example" cannot come back in this session. */
  protected readonly changed = signal(false);
  /** The Position of the most recent change, for the visual cue. */
  private readonly lastPosition = signal<number | null>(null);
  protected readonly announcement = signal('');

  // Prediction (optional). One of: open, locked, revealed. Skipping hides the whole interaction for the session.
  protected readonly skipped = signal(false);
  protected readonly draft = signal('');
  protected readonly locked = signal<Locked | null>(null);
  protected readonly revealed = signal<Revealed | null>(null);

  protected readonly total = computed(() => total(this.pattern()));

  /** Highest Position first, as the pattern is written. */
  protected readonly cells = computed(() => {
    const bits = this.pattern();
    const parts = contributions(bits);
    const cells = bits.map((bit, position) => {
      const weight = weightOf(position);
      if (!weight.ok) throw new Error(`no Weight for Position ${position}`); // unreachable: a pattern has at most 8 Positions
      return { position, bit, weight: weight.value, contribution: parts[position] ?? 0 };
    });
    const top = cells[cells.length - 1]?.weight ?? 1;
    // `share` only sizes the Contribution meter: this Contribution as a fraction of the largest Weight shown.
    return cells.map((c) => ({ ...c, share: c.contribution / top })).reverse();
  });

  /** The cell of the inspected Position, derived from the same domain values as the table. */
  protected readonly inspected = computed(() => this.cells().find((c) => c.position === this.selected()) ?? null);

  protected readonly justChanged = (position: number): boolean => this.lastPosition() === position;

  protected readonly signed = signed;

  /** What may be typed and locked right now. */
  protected readonly draftValue = computed(() => parseSigned(this.draft()));
  protected readonly canLock = computed(() => this.selected() !== null && this.draftValue() !== null);
  /** The explanation under a revealed comparison, in the actual values. */
  protected readonly difference = computed(() => {
    const r = this.revealed();
    return r ? signed(r.actual - r.predicted) : '';
  });

  /** Inspect a Position, or stop inspecting it if it is already the one inspected. One Position at a time. */
  protected select(position: number): void {
    this.selected.update((current) => (current === position ? null : position));
  }

  /** Back to nothing inspected. Focus returns to the Position that was inspected, since the button that was pressed leaves the page. */
  protected deselect(): void {
    const position = this.selected();
    this.selected.set(null);
    if (position !== null) this.host.nativeElement.querySelector<HTMLElement>(`button.pos[data-position="${position}"]`)?.focus();
  }

  protected typeDraft(text: string): void {
    this.draft.set(text);
  }

  /** Fixes the typed change to the Position selected now. Nothing about the actual result is shown. */
  protected lock(event?: Event): void {
    event?.preventDefault();
    const position = this.selected();
    const change = this.draftValue();
    if (position === null || change === null || this.locked() || this.revealed()) return;
    this.locked.set({ position, change });
    // The Lock button and the field leave the page, so focus goes to the next thing the learner does: flip that Bit.
    this.focusAfterRender(`button.bit[data-position="${position}"]`);
  }

  /** Clears the prediction and the comparison, ready for a new experiment. */
  protected tryAnother(): void {
    this.locked.set(null);
    this.revealed.set(null);
    this.draft.set('');
    // The Try another button leaves the page; a new experiment starts at the field (when a Position is selected).
    this.focusAfterRender('.prediction input:not(:disabled)');
  }

  protected skip(): void {
    this.skipped.set(true);
    this.locked.set(null);
    this.revealed.set(null);
    this.draft.set('');
    // The whole panel leaves the page; focus returns to the Bench, at the Bit switch the learner would flip next.
    this.focusAfterRender(`button.bit[data-position="${this.selected() ?? 0}"]`);
  }

  protected flip(position: number): void {
    const before = this.pattern();
    const next = flipBit(before, position);
    const effect = flipEffect(before, position);
    if (!next.ok || !effect.ok) return; // unreachable from the template, which only offers valid Positions
    const lock = this.locked();
    if (lock && lock.position === position && !this.revealed()) {
      this.revealed.set({
        position,
        predicted: lock.change,
        actual: effect.value.change,
        weight: effect.value.weight,
        from: before[position] ?? 0,
        to: next.value[position] ?? 0,
      });
      this.locked.set(null);
    }
    this.pattern.set(next.value);
    this.changed.set(true);
    this.lastPosition.set(position);
    this.announcement.set(`Position ${position} is now ${next.value[position]}. Total ${total(next.value)}.`);
    this.pulse(position);
  }

  /** Focus an element once the view has been updated, if it exists then. Used when the focused control has just been removed. */
  private focusAfterRender(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), { injector: this.injector });
  }

  /** A brief confirmation of what changed. Skipped when the learner prefers reduced motion or the platform cannot animate. */
  private pulse(position: number): void {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const play = (selector: string, keyframes: Keyframe[], duration: number) =>
          root.querySelectorAll<HTMLElement>(selector).forEach((el) => el.animate?.(keyframes, { duration, easing: EASE_OUT }));
        play(`.num[data-col="${position}"], .term[data-col="${position}"]`, [{ transform: 'scale(1.4)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }], 240);
        play('.total .value', [{ transform: 'translateY(-10px)', opacity: 0.2 }, { transform: 'translateY(0)', opacity: 1 }], 200);
      },
      { injector: this.injector },
    );
  }
}
