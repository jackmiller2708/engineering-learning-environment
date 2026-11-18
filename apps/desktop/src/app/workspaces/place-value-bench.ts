import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { contributions, flipBit, parsePattern, total, weightOf, type BitPattern } from '@ele/domain';

/** The Bench opens on this pattern every time (it is not saved). Width 4 is the default. */
const STARTING_PATTERN = '1011';

function starting(): BitPattern {
  const r = parsePattern(STARTING_PATTERN);
  if (!r.ok) throw new Error(`starting pattern ${STARTING_PATTERN} is invalid: ${r.error}`);
  return r.value;
}

/**
 * The place-value bench (T2): one switch per Bit, each Position's Weight and Contribution, and the Total.
 * All arithmetic is in `@ele/domain`. State is local and lasts as long as this component, so reopening a Lab starts again.
 */
@Component({
  selector: 'app-place-value-bench',
  templateUrl: './place-value-bench.html',
  styleUrl: './place-value-bench.css',
})
export class PlaceValueBench {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly pattern = signal<BitPattern>(starting());
  /** The inspected Position, or null. Selecting never changes the pattern; it is not saved. */
  protected readonly selected = signal<number | null>(null);
  /** Set by the first Bit change and never cleared, so "Starting example" cannot come back in this session. */
  protected readonly changed = signal(false);
  /** The Position of the most recent change, for the visual cue and the announcement. */
  private readonly lastPosition = signal<number | null>(null);
  protected readonly announcement = signal('');

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
    return cells.reverse();
  });

  /** The Contributions as written, highest Position first: "8 + 0 + 2 + 1". */
  protected readonly sum = computed(() => this.cells().map((c) => c.contribution).join(' + '));

  /** The cell of the inspected Position, derived from the same domain values as the table. */
  protected readonly inspected = computed(() => this.cells().find((c) => c.position === this.selected()) ?? null);

  protected readonly justChanged = (position: number): boolean => this.lastPosition() === position;

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

  protected flip(position: number): void {
    const next = flipBit(this.pattern(), position);
    if (!next.ok) return; // unreachable from the template, which only offers valid Positions
    this.pattern.set(next.value);
    this.changed.set(true);
    this.lastPosition.set(position);
    this.announcement.set(`Position ${position} is now ${next.value[position]}. Total ${total(next.value)}.`);
  }
}
