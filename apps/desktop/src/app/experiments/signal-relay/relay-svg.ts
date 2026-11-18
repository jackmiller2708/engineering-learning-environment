import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Line } from './relay-circuit';
import { BEACON, GATE, LINES, SWITCHES, SWITCH_LABEL, VIEW, WIRES, WIRE_IDS, flowDots, lengthOf, pointAt, type WireId } from './relay-layout';
import type { RelayView } from './relay-view';

const points = (id: WireId) => WIRES[id].map((p) => p.join(',')).join(' ');
const LENGTH = { a: lengthOf(WIRES.a), b: lengthOf(WIRES.b), out: lengthOf(WIRES.out) };

/** The relay drawn as SVG. Draws the view it is given and reports a toggle; it owns no circuit rules. */
@Component({
  selector: 'app-relay-svg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + box.w + ' ' + box.h" role="group" aria-label="Relay circuit">
      @for (id of wireIds; track id) {
        <polyline class="wire" [attr.points]="pts[id]" />
        <polyline class="lit" [attr.points]="pts[id]" [attr.stroke-dasharray]="dash(id)" />
      }
      @for (d of dots(); track d.key) {
        <circle class="dot" [attr.cx]="d.x" [attr.cy]="d.y" r="3" />
      }

      <rect class="gate" [class.on]="view().gate" [attr.x]="gate.x" [attr.y]="gate.y" [attr.width]="gate.w" [attr.height]="gate.h" rx="8" />
      <text class="name" [attr.x]="gate.x + gate.w / 2" [attr.y]="gate.y + gate.h / 2 + 5" text-anchor="middle">Gate</text>

      @if (view().beacon) {
        <circle class="halo" [attr.cx]="beacon.cx" [attr.cy]="beacon.cy" [attr.r]="beacon.r + 16" />
      }
      <circle class="beacon" [class.on]="view().beacon" [attr.cx]="beacon.cx" [attr.cy]="beacon.cy" [attr.r]="beacon.r" />
      <text class="name" [attr.x]="beacon.cx" [attr.y]="beacon.cy + beacon.r + 22" text-anchor="middle">Beacon</text>

      @for (line of lines; track line) {
        <g
          class="switch"
          role="switch"
          tabindex="0"
          [attr.aria-checked]="on(line)"
          [attr.aria-label]="labels[line]"
          (click)="toggled.emit(line)"
          (keydown.space)="$event.preventDefault(); toggled.emit(line)"
          (keydown.enter)="$event.preventDefault(); toggled.emit(line)"
        >
          <rect class="hit" [attr.x]="sw[line].x - 6" [attr.y]="sw[line].y - 6" [attr.width]="sw[line].w + 12" [attr.height]="sw[line].h + 12" />
          <rect class="track" [class.on]="on(line)" [attr.x]="sw[line].x" [attr.y]="sw[line].y" [attr.width]="sw[line].w" [attr.height]="sw[line].h" rx="24" />
          <circle class="knob" [attr.cx]="knobX(line)" [attr.cy]="sw[line].y + sw[line].h / 2" r="17" />
          <text class="name" [attr.x]="sw[line].x + sw[line].w / 2" [attr.y]="sw[line].y - 12" text-anchor="middle">{{ labels[line] }}</text>
        </g>
      }
    </svg>
  `,
  styles: `
    :host { display: block; inline-size: 100%; block-size: 100%; min-block-size: 0; }
    svg { display: block; inline-size: 100%; block-size: 100%; }
    .wire { fill: none; stroke: var(--rule); stroke-width: 6; stroke-linejoin: round; stroke-linecap: round; }
    .lit { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linejoin: round; stroke-linecap: butt; }
    .dot { fill: var(--on-accent); opacity: 0.9; }
    .gate { fill: var(--raised); stroke: var(--edge); stroke-width: 2; transition: fill 0.18s; }
    .gate.on { fill: var(--new-tint); stroke: var(--accent); }
    .name { fill: var(--muted); font: 600 13px var(--ui); }
    .halo { fill: var(--accent); opacity: 0.18; }
    .beacon { fill: var(--raised); stroke: var(--edge); stroke-width: 2; }
    .beacon.on { fill: var(--accent); stroke: var(--accent); }
    .switch { cursor: pointer; outline: none; }
    .hit { fill: transparent; }
    .track { fill: var(--bench); stroke: var(--edge); stroke-width: 2; }
    .track.on { fill: var(--new-tint); stroke: var(--accent); }
    .knob { fill: var(--muted); stroke: var(--panel); stroke-width: 2; }
    .switch:has(.track.on) .knob { fill: var(--accent); }
    .switch:focus-visible .track { stroke: var(--focus); stroke-width: 4; }
  `,
})
export class RelaySvg {
  readonly view = input.required<RelayView>();
  readonly now = input(0);
  readonly flow = input(true);
  readonly toggled = output<Line>();

  protected readonly box = VIEW;
  protected readonly gate = GATE;
  protected readonly beacon = BEACON;
  protected readonly sw = SWITCHES;
  protected readonly labels = SWITCH_LABEL;
  protected readonly lines = LINES;
  protected readonly wireIds = WIRE_IDS;
  protected readonly pts = { a: points('a'), b: points('b'), out: points('out') };

  protected on = (line: Line) => this.view().knob[line] >= 0.5;
  protected knobX = (line: Line) => SWITCHES[line].x + 24 + 36 * this.view().knob[line];
  protected dash = (id: WireId) => `${LENGTH[id] * this.view()[id]} ${LENGTH[id] + 1}`;

  protected readonly dots = computed(() => {
    if (!this.flow()) return [];
    const v = this.view();
    return WIRE_IDS.flatMap((id) =>
      flowDots(LENGTH[id], v[id], this.now()).map((d, i) => {
        const [x, y] = pointAt(WIRES[id], d);
        return { key: `${id}${i}`, x, y };
      }),
    );
  });
}
