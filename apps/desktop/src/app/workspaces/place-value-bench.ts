import { Component, computed, signal } from '@angular/core';
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
  private readonly pattern = signal<BitPattern>(starting());
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

  protected readonly justChanged = (position: number): boolean => this.lastPosition() === position;

  protected flip(position: number): void {
    const next = flipBit(this.pattern(), position);
    if (!next.ok) return; // unreachable from the template, which only offers valid Positions
    this.pattern.set(next.value);
    this.changed.set(true);
    this.lastPosition.set(position);
    this.announcement.set(`Position ${position} is now ${next.value[position]}. Total ${total(next.value)}.`);
  }
}
