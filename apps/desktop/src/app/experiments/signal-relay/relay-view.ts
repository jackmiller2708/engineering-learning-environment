// What to show at a moment in time while a change travels through the circuit. A pure function of the view the
// change started from, the circuit state it is heading to, and the time since it began. Starting from the view
// (not from the previous logical state) means an interrupted change simply carries on from what is on screen.
import { evaluate, type Line, type RelayState } from './relay-circuit';

export interface RelayView {
  /** How far along each wire the signal has reached (0 = dark, 1 = fully lit). */
  readonly a: number;
  readonly b: number;
  readonly out: number;
  readonly gate: boolean;
  readonly beacon: boolean;
  /** Switch knob position, 0 = off, 1 = on. */
  readonly knob: Readonly<Record<Line, number>>;
}

export interface Timing {
  /** Time for the signal to cross one stage (switch to gate, gate to beacon). */
  readonly stageMs: number;
  readonly knobMs: number;
}
export const MOTION: Timing = { stageMs: 280, knobMs: 120 };
export const STILL: Timing = { stageMs: 0, knobMs: 0 };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Moves from `from` to `to` over `span` ms, beginning `delay` ms in. Holds `from` until then. */
function ease(from: number, to: number, age: number, delay: number, span: number): number {
  const t = span === 0 ? (age >= delay ? 1 : 0) : clamp01((age - delay) / span);
  return t >= 1 ? to : from + (to - from) * t; // exactly `to` once arrived, with no rounding left over
}

/** The view of a circuit that has fully settled. */
export function viewOf(state: RelayState): RelayView {
  const s = evaluate(state);
  const n = (b: boolean) => (b ? 1 : 0);
  return { a: n(s.a), b: n(s.b), out: n(s.out), gate: s.gate, beacon: s.beacon, knob: { a: n(state.a), b: n(state.b) } };
}

/** The view `ageMs` after a change to `to` began while `from` was on screen. Settles into `viewOf(to)`. */
export function relayView(from: RelayView, to: RelayState, ageMs: number, timing: Timing = MOTION): RelayView {
  const target = viewOf(to);
  const { stageMs, knobMs } = timing;
  return {
    a: ease(from.a, target.a, ageMs, 0, stageMs),
    b: ease(from.b, target.b, ageMs, 0, stageMs),
    gate: ageMs >= stageMs ? target.gate : from.gate,
    out: ease(from.out, target.out, ageMs, stageMs, stageMs),
    beacon: ageMs >= 2 * stageMs ? target.beacon : from.beacon,
    knob: { a: ease(from.knob.a, target.knob.a, ageMs, 0, knobMs), b: ease(from.knob.b, target.knob.b, ageMs, 0, knobMs) },
  };
}

/** True while a change is still travelling, so the clock can stop when nothing moves. */
export const isSettling = (ageMs: number, timing: Timing): boolean => ageMs < 2 * timing.stageMs + 1;
