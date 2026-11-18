// What to show at a moment in time while a change travels through the circuit. A pure function of the old and new
// state and the time since the change, so both renderers show exactly the same thing at the same instant.
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

/** A wire coming on fills along its length from `start`; a wire going off goes dark when its stage begins. */
function reach(was: boolean, now: boolean, age: number, start: number, span: number): number {
  if (was === now) return now ? 1 : 0;
  if (now) return span === 0 ? 1 : clamp01((age - start) / span);
  return age >= start ? 0 : 1;
}

export function relayView(from: RelayState, to: RelayState, ageMs: number, timing: Timing = MOTION): RelayView {
  const was = evaluate(from);
  const now = evaluate(to);
  const { stageMs } = timing;
  const knob = (line: Line) => {
    const target = to[line] ? 1 : 0;
    if (from[line] === to[line] || timing.knobMs === 0) return target;
    const t = clamp01(ageMs / timing.knobMs);
    return (from[line] ? 1 : 0) + (target - (from[line] ? 1 : 0)) * t;
  };
  return {
    a: reach(was.a, now.a, ageMs, 0, stageMs),
    b: reach(was.b, now.b, ageMs, 0, stageMs),
    gate: ageMs >= stageMs ? now.gate : was.gate,
    out: reach(was.out, now.out, ageMs, stageMs, stageMs),
    beacon: ageMs >= 2 * stageMs ? now.beacon : was.beacon,
    knob: { a: knob('a'), b: knob('b') },
  };
}

/** True while a change is still travelling, so the clock can stop when nothing moves. */
export const isSettling = (ageMs: number, timing: Timing): boolean => ageMs < 2 * timing.stageMs + 1;
