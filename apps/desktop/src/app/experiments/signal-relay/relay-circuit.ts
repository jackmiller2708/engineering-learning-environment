// The relay's engineering rules. Pure TypeScript: no Angular, no DOM, no rendering. Both renderers read this and
// nothing else for what the circuit does. Experiment only: kept out of @ele/domain so no package contract changes.

export type Line = 'a' | 'b';

/** What the learner controls: the two supply-line switches. */
export interface RelayState {
  readonly a: boolean;
  readonly b: boolean;
}

export const DARK: RelayState = { a: false, b: false };

export function toggleLine(state: RelayState, line: Line): RelayState {
  return { ...state, [line]: !state[line] };
}

/** The signal on every part of the circuit, in the order the signal travels. */
export interface Signals {
  readonly a: boolean; // wire from switch A to the gate
  readonly b: boolean; // wire from switch B to the gate
  readonly gate: boolean; // the gate's output
  readonly out: boolean; // wire from the gate to the beacon
  readonly beacon: boolean;
}

// The learner is meant to discover this rule by experiment, so it is named nowhere in the interface.
const gate = (a: boolean, b: boolean): boolean => a && b;

export function evaluate(state: RelayState): Signals {
  const g = gate(state.a, state.b);
  return { a: state.a, b: state.b, gate: g, out: g, beacon: g };
}
