// Where things are in the diagram, in one coordinate space both renderers share. Geometry only: no rules, no drawing.
import type { Line } from './relay-circuit';

export const VIEW = { w: 480, h: 260 } as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export type Point = readonly [number, number];
export type WireId = 'a' | 'b' | 'out';

export const SWITCHES: Record<Line, Rect> = {
  a: { x: 30, y: 56, w: 84, h: 48 },
  b: { x: 30, y: 156, w: 84, h: 48 },
};
export const SWITCH_LABEL: Record<Line, string> = { a: 'Line A', b: 'Line B' };
export const GATE: Rect = { x: 190, y: 96, w: 96, h: 68 };
export const BEACON = { cx: 410, cy: 130, r: 30 } as const;

export const WIRES: Record<WireId, readonly Point[]> = {
  a: [[114, 80], [152, 80], [152, 114], [190, 114]],
  b: [[114, 180], [152, 180], [152, 146], [190, 146]],
  out: [[286, 130], [380, 130]],
};
export const WIRE_IDS: readonly WireId[] = ['a', 'b', 'out'];
export const LINES: readonly Line[] = ['a', 'b'];

const seg = (p: Point, q: Point) => Math.hypot(q[0] - p[0], q[1] - p[1]);

export function lengthOf(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += seg(points[i - 1], points[i]);
  return total;
}

/** The point `distance` along the polyline, clamped to its ends. */
export function pointAt(points: readonly Point[], distance: number): Point {
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const s = seg(points[i - 1], points[i]);
    if (left <= s) {
      const t = s === 0 ? 0 : left / s;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
    }
    left -= s;
  }
  return points[points.length - 1];
}

/** Distances (along a wire of `length`) of the travelling signal dots, only within the lit part. */
export function flowDots(length: number, lit: number, nowMs: number, spacing = 36, speed = 0.06): number[] {
  const reach = length * lit;
  if (reach <= 0) return [];
  const dots: number[] = [];
  const shift = (nowMs * speed) % spacing;
  for (let d = shift; d <= reach; d += spacing) dots.push(d);
  return dots;
}

export const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
