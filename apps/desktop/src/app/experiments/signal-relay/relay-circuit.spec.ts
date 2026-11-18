import { describe, expect, it } from 'vitest';
import { DARK, evaluate, toggleLine } from './relay-circuit';
import { MOTION, STILL, isSettling, relayView, viewOf } from './relay-view';
import { flowDots, lengthOf, pointAt, WIRES } from './relay-layout';

describe('relay circuit', () => {
  it('starts dark', () => {
    expect(evaluate(DARK)).toEqual({ a: false, b: false, gate: false, out: false, beacon: false });
  });

  it.each([
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, true],
  ])('lines a=%s b=%s light the beacon: %s', (a, b, lit) => {
    const s = evaluate({ a, b });
    expect([s.a, s.b]).toEqual([a, b]);
    expect(s.gate).toBe(lit);
    expect(s.out).toBe(lit);
    expect(s.beacon).toBe(lit);
  });

  it('toggles one line without touching the other or the original', () => {
    const next = toggleLine(DARK, 'a');
    expect(next).toEqual({ a: true, b: false });
    expect(DARK).toEqual({ a: false, b: false });
    expect(toggleLine(next, 'a')).toEqual(DARK);
  });
});

describe('what is shown while a change travels', () => {
  const both = { a: true, b: true };
  const onlyA = { a: true, b: false };
  const { stageMs } = MOTION;
  const go = (from: typeof both, to: typeof both, age: number) => relayView(viewOf(from), to, age);

  it('shows the old state at the instant of the change, apart from the switch', () => {
    const v = go(onlyA, both, 0);
    expect([v.a, v.b, v.gate, v.out, v.beacon]).toEqual([1, 0, false, 0, false]);
  });

  it('lights the new wire along its length, then the gate, then the output wire, then the beacon', () => {
    expect(go(onlyA, both, stageMs / 2).b).toBeCloseTo(0.5);
    expect(go(onlyA, both, stageMs / 2).gate).toBe(false);
    const gateOn = go(onlyA, both, stageMs);
    expect([gateOn.b, gateOn.gate, gateOn.out, gateOn.beacon]).toEqual([1, true, 0, false]);
    const outHalf = go(onlyA, both, stageMs * 1.5);
    expect(outHalf.out).toBeCloseTo(0.5);
    expect(outHalf.beacon).toBe(false);
    const done = go(onlyA, both, stageMs * 2);
    expect([done.out, done.beacon]).toEqual([1, true]);
  });

  it('switching off drains the input, then the gate and output, then the beacon', () => {
    const v0 = go(both, onlyA, 0);
    expect([v0.a, v0.b, v0.gate, v0.out, v0.beacon]).toEqual([1, 1, true, 1, true]);
    expect(go(both, onlyA, stageMs / 2).b).toBeCloseTo(0.5);
    const v1 = go(both, onlyA, stageMs);
    expect([v1.b, v1.gate, v1.out, v1.beacon]).toEqual([0, false, 1, true]);
    expect(go(both, onlyA, stageMs * 2)).toEqual(viewOf(onlyA));
  });

  it('settles into exactly the view of the new state, and instantly with STILL', () => {
    expect(go(onlyA, both, 10_000)).toEqual(viewOf(both));
    expect(relayView(viewOf(onlyA), both, 0, STILL)).toEqual(viewOf(both));
    expect(isSettling(0, MOTION)).toBe(true);
    expect(isSettling(10_000, MOTION)).toBe(false);
  });

  it('slides the switch knob over its own short time', () => {
    expect(go(DARK, onlyA, MOTION.knobMs / 2).knob.a).toBeCloseTo(0.5);
    expect(go(DARK, onlyA, 1000).knob).toEqual({ a: 1, b: 0 });
  });
});

describe('a change that interrupts another', () => {
  const dark = viewOf(DARK);
  const both = { a: true, b: true };
  const { stageMs } = MOTION;

  it('carries on from the displayed view: no value jumps at the moment of interruption', () => {
    // A is switched on and the signal is halfway along its wire when B is switched on.
    const first = relayView(dark, { a: true, b: false }, stageMs / 2);
    expect(first.a).toBeCloseTo(0.5);
    const second = relayView(first, both, 0);
    expect(second).toEqual(first); // nothing moved at the instant of the second change
    expect(relayView(first, both, 1).a).toBeCloseTo(0.5, 1); // and it keeps going from there
  });

  it('does not jump when a switch is reversed mid-travel', () => {
    const first = relayView(dark, { a: true, b: false }, stageMs * 0.75);
    const back = relayView(first, { a: false, b: false }, 0);
    expect(back.a).toBeCloseTo(0.75);
    expect(back.knob.a).toBeCloseTo(1); // the knob was already across
    const later = relayView(first, DARK, stageMs / 2);
    expect(later.a).toBeCloseTo(0.375);
  });

  it('holds a gate or beacon that has not changed yet, and never flickers it', () => {
    const lit = viewOf(both);
    const dimming = relayView(lit, { a: true, b: false }, stageMs / 2); // gate still on, going off at stageMs
    expect(dimming.gate).toBe(true);
    const again = relayView(dimming, both, 0); // switched back on before the gate went off
    expect(again.gate).toBe(true);
    expect(relayView(dimming, both, stageMs).gate).toBe(true);
  });

  it('settles into the view of the final state after any number of interruptions', () => {
    const steps = [{ a: true, b: false }, both, { a: false, b: true }, both, DARK, { a: true, b: false }, both];
    let shown = dark;
    let age = 0;
    for (const to of steps) {
      shown = relayView(shown, to, age); // age grows by a different amount each time, always short of settled
      age = (age + 77) % (stageMs * 2 - 10);
    }
    expect(relayView(shown, both, 10_000)).toEqual(viewOf(both));
    expect(relayView(shown, DARK, 10_000)).toEqual(viewOf(DARK));
  });
});

describe('wire geometry', () => {
  it('measures and walks a polyline', () => {
    const p = [[0, 0], [30, 0], [30, 40]] as const;
    expect(lengthOf(p)).toBe(70);
    expect(pointAt(p, 15)).toEqual([15, 0]);
    expect(pointAt(p, 50)).toEqual([30, 20]);
    expect(pointAt(p, 999)).toEqual([30, 40]);
  });

  it('keeps flow dots inside the lit part only', () => {
    const len = lengthOf(WIRES.a);
    expect(flowDots(len, 0, 100)).toEqual([]);
    const dots = flowDots(len, 0.5, 100);
    expect(dots.length).toBeGreaterThan(0);
    expect(Math.max(...dots)).toBeLessThanOrEqual(len / 2);
  });
});
