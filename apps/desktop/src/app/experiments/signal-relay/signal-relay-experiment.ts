import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DARK, evaluate, toggleLine, type Line, type RelayState } from './relay-circuit';
import { RelayCanvas } from './relay-canvas';
import { RelaySvg } from './relay-svg';
import { MOTION, STILL, isSettling, relayView, viewOf } from './relay-view';

export type Renderer = 'svg' | 'canvas';

/**
 * An isolated experiment. This shell owns the one circuit state and the clock; the two renderers only draw what
 * they are given and report which switch was flipped. Switching renderer therefore cannot change the circuit.
 */
@Component({
  selector: 'app-signal-relay-experiment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RelaySvg, RelayCanvas],
  templateUrl: './signal-relay-experiment.html',
  styleUrl: './signal-relay-experiment.css',
})
export class SignalRelayExperiment {
  protected readonly renderer = signal<Renderer>('svg');
  protected readonly hintOpen = signal(false);

  private readonly state = signal<RelayState>(DARK);
  /** What was on screen when the current change began. */
  private readonly from = signal(viewOf(DARK));
  private readonly changedAt = signal(0);
  protected readonly now = signal(0);

  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly timing = this.reduced ? STILL : MOTION;
  protected readonly flow = !this.reduced;

  protected readonly view = computed(() => relayView(this.from(), this.state(), this.now() - this.changedAt(), this.timing));
  protected readonly online = computed(() => this.view().beacon);

  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected toggle(line: Line): void {
    this.change(toggleLine(this.state(), line));
  }

  protected reset(): void {
    this.change(DARK);
  }

  private change(next: RelayState): void {
    const t = performance.now();
    // Start from what is on screen right now, so a change that interrupts another carries on without a jump.
    this.from.set(relayView(this.from(), this.state(), t - this.changedAt(), this.timing));
    this.state.set(next);
    this.changedAt.set(t);
    this.now.set(t);
    this.run();
  }

  /** Runs only while something moves: a change travelling, or signal flowing on a lit wire. */
  private run(): void {
    if (this.reduced || this.frame) return;
    const tick = (t: number) => {
      this.now.set(t);
      const s = evaluate(this.state());
      const live = s.a || s.b || s.gate;
      this.frame = live || isSettling(t - this.changedAt(), this.timing) ? requestAnimationFrame(tick) : 0;
    };
    this.frame = requestAnimationFrame(tick);
  }
}
