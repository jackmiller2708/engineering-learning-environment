import { describe, expect, it } from 'vitest';
import { DARK, evaluate, toggleLine } from './relay-circuit';
import { MOTION, STILL, isSettling, relayView } from './relay-view';
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

  it('shows the old state at the instant of the change, apart from the switch', () => {
    const v = relayView(onlyA, both, 0);
    expect([v.a, v.b, v.gate, v.out, v.beacon]).toEqual([1, 0, false, 0, false]);
  });

  it('lights the new wire along its length, then the gate, then the output wire, then the beacon', () => {
    const half = relayView(onlyA, both, stageMs / 2);
    expect(half.b).toBeCloseTo(0.5);
    expect(half.gate).toBe(false);
    const gateOn = relayView(onlyA, both, stageMs);
    expect([gateOn.b, gateOn.gate, gateOn.out, gateOn.beacon]).toEqual([1, true, 0, false]);
    const outHalf = relayView(onlyA, both, stageMs * 1.5);
    expect(outHalf.out).toBeCloseTo(0.5);
    expect(outHalf.beacon).toBe(false);
    const done = relayView(onlyA, both, stageMs * 2);
    expect([done.out, done.beacon]).toEqual([1, true]);
  });

  it('switching off darkens the input at once and the rest as the change arrives', () => {
    const v0 = relayView(both, onlyA, 0);
    expect([v0.a, v0.b, v0.gate, v0.out, v0.beacon]).toEqual([1, 0, true, 1, true]);
    const v1 = relayView(both, onlyA, stageMs);
    expect([v1.gate, v1.out, v1.beacon]).toEqual([false, 0, true]);
    expect(relayView(both, onlyA, stageMs * 2).beacon).toBe(false);
  });

  it('is settled and equal to the new state after the change, and instantly with STILL', () => {
    const settled = relayView(onlyA, both, 10_000);
    expect(settled).toEqual(relayView(both, both, 0));
    expect(relayView(onlyA, both, 0, STILL).beacon).toBe(true);
    expect(isSettling(0, MOTION)).toBe(true);
    expect(isSettling(10_000, MOTION)).toBe(false);
  });

  it('slides the switch knob over its own short time', () => {
    expect(relayView({ a: false, b: false }, { a: true, b: false }, MOTION.knobMs / 2).knob.a).toBeCloseTo(0.5);
    expect(relayView({ a: false, b: false }, { a: true, b: false }, 1000).knob).toEqual({ a: 1, b: 0 });
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
