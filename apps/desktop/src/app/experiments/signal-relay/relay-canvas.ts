import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Line } from './relay-circuit';
import { BEACON, GATE, LINES, SWITCHES, SWITCH_LABEL, VIEW, WIRES, WIRE_IDS, flowDots, inside, lengthOf, pointAt } from './relay-layout';
import type { RelayView } from './relay-view';

const THEME_TOKENS = ['--rule', '--accent', '--on-accent', '--raised', '--edge', '--new-tint', '--muted', '--bench', '--panel', '--focus', '--ui'] as const;
type Theme = Record<(typeof THEME_TOKENS)[number], string>;

/**
 * The relay drawn on a 2D canvas. It draws the view it is given and reports a toggle; it owns no circuit rules.
 * Unlike SVG, everything a browser gives elements for free is written here: fitting to the box, hit testing,
 * keyboard focus and its ring, the pointer cursor, theme colours, and redrawing on every change.
 */
@Component({
  selector: 'app-relay-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas
    #canvas
    tabindex="0"
    role="group"
    aria-label="Relay circuit. Arrow keys choose a switch, Space or Enter flips it."
    (pointerdown)="press($event)"
    (pointerup)="pointerDown = false"
    (pointercancel)="pointerDown = false"
    (pointermove)="hover($event)"
    (keydown)="key($event)"
    (focus)="onFocus()"
    (blur)="ring.set(false)"
  ></canvas>`,
  styles: `
    :host { display: block; inline-size: 100%; block-size: 100%; min-block-size: 0; }
    canvas { display: block; inline-size: 100%; block-size: 100%; outline: none; }
  `,
})
export class RelayCanvas {
  readonly view = input.required<RelayView>();
  readonly now = input(0);
  readonly flow = input(true);
  readonly toggled = output<Line>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  /** The keyboard focus ring: on after keyboard use or Tab, off after a pointer press. */
  protected readonly ring = signal(false);
  protected pointerDown = false;
  private readonly cursorLine = signal<Line>('a');
  private readonly size = signal<{ w: number; h: number; dpr: number }>({ w: VIEW.w, h: VIEW.h, dpr: 1 });
  private theme: Theme | null = null;

  constructor() {
    afterNextRender(() => {
      const el = this.canvas().nativeElement;
      const measure = () => {
        const r = el.getBoundingClientRect();
        const w = r.width || VIEW.w;
        const h = r.height || VIEW.h;
        const dpr = window.devicePixelRatio || 1;
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        this.size.set({ w, h, dpr });
      };
      measure();
      const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      ro?.observe(el);
      // Colours are resolved from CSS tokens, so a theme change has to be noticed and redrawn by hand.
      const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
      const retheme = () => {
        this.theme = null;
        this.size.update((s) => ({ ...s }));
      };
      scheme?.addEventListener?.('change', retheme);
      inject(DestroyRef).onDestroy(() => {
        ro?.disconnect();
        scheme?.removeEventListener?.('change', retheme);
      });
    });
    effect(() => this.draw(this.view(), this.now(), this.flow(), this.size(), this.ring(), this.cursorLine()));
  }

  // ---- input: the canvas knows nothing about its drawn shapes, so it finds them itself ----

  /** Pointer position in diagram coordinates, undoing the same fit-and-centre used to draw. */
  private toDiagram(e: PointerEvent): [number, number] {
    const el = this.canvas().nativeElement;
    const r = el.getBoundingClientRect();
    const { scale, ox, oy } = this.fit(r.width || VIEW.w, r.height || VIEW.h);
    return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale];
  }

  private lineAt(e: PointerEvent): Line | null {
    const [x, y] = this.toDiagram(e);
    return LINES.find((l) => inside(grow(SWITCHES[l], 6), x, y)) ?? null;
  }

  protected onFocus(): void {
    // A press focuses the canvas before anything else; only focus that did not come from a press is the keyboard's.
    if (!this.pointerDown) this.ring.set(true);
  }

  protected press(e: PointerEvent): void {
    this.pointerDown = true;
    this.ring.set(false);
    const line = this.lineAt(e);
    if (line) {
      this.cursorLine.set(line);
      this.toggled.emit(line);
    }
  }

  protected hover(e: PointerEvent): void {
    this.canvas().nativeElement.style.cursor = this.lineAt(e) ? 'pointer' : 'default';
  }

  protected key(e: KeyboardEvent): void {
    if (e.key !== 'Tab') this.ring.set(true);
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.toggled.emit(this.cursorLine());
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const down = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      this.cursorLine.set(down ? 'b' : 'a');
    }
  }

  // ---- drawing ----

  private fit(w: number, h: number) {
    const scale = Math.min(w / VIEW.w, h / VIEW.h);
    return { scale, ox: (w - VIEW.w * scale) / 2, oy: (h - VIEW.h * scale) / 2 };
  }

  private colors(): Theme {
    if (this.theme) return this.theme;
    const el = this.canvas().nativeElement;
    const probe = document.createElement('span');
    el.parentElement?.appendChild(probe);
    const out = {} as Theme;
    for (const t of THEME_TOKENS) {
      probe.style.color = `var(${t})`;
      out[t] = getComputedStyle(probe).color;
    }
    out['--ui'] = getComputedStyle(el).getPropertyValue('--ui') || 'sans-serif';
    probe.remove();
    return (this.theme = out);
  }

  private draw(v: RelayView, now: number, flow: boolean, size: { w: number; h: number; dpr: number }, focused: boolean, cursor: Line): void {
    const ctx = this.canvas().nativeElement.getContext('2d');
    if (!ctx) return;
    const c = this.colors();
    const { scale, ox, oy } = this.fit(size.w, size.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.w * size.dpr, size.h * size.dpr);
    ctx.setTransform(size.dpr * scale, 0, 0, size.dpr * scale, size.dpr * ox, size.dpr * oy);
    ctx.lineJoin = 'round';

    for (const id of WIRE_IDS) {
      const pts = WIRES[id];
      const len = lengthOf(pts);
      path(ctx, pts);
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.lineWidth = 6;
      ctx.strokeStyle = c['--rule'];
      ctx.stroke();
      if (v[id] > 0) {
        path(ctx, pts);
        ctx.setLineDash([len * v[id], len + 1]);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = c['--accent'];
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (flow) {
        ctx.fillStyle = c['--on-accent'];
        for (const d of flowDots(len, v[id], now)) {
          const [x, y] = pointAt(pts, d);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    box(ctx, GATE.x, GATE.y, GATE.w, GATE.h, 8, v.gate ? c['--new-tint'] : c['--raised'], v.gate ? c['--accent'] : c['--edge'], 2);
    label(ctx, c, 'Gate', GATE.x + GATE.w / 2, GATE.y + GATE.h / 2 + 5);

    if (v.beacon) {
      const g = ctx.createRadialGradient(BEACON.cx, BEACON.cy, BEACON.r, BEACON.cx, BEACON.cy, BEACON.r + 16);
      g.addColorStop(0, c['--accent']);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(BEACON.cx, BEACON.cy, BEACON.r + 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(BEACON.cx, BEACON.cy, BEACON.r, 0, Math.PI * 2);
    ctx.fillStyle = v.beacon ? c['--accent'] : c['--raised'];
    ctx.strokeStyle = v.beacon ? c['--accent'] : c['--edge'];
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    label(ctx, c, 'Beacon', BEACON.cx, BEACON.cy + BEACON.r + 22);

    for (const line of LINES) {
      const r = SWITCHES[line];
      const on = v.knob[line] >= 0.5;
      box(ctx, r.x, r.y, r.w, r.h, 24, on ? c['--new-tint'] : c['--bench'], on ? c['--accent'] : c['--edge'], 2);
      if (focused && cursor === line) box(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 27, 'transparent', c['--focus'], 3);
      ctx.beginPath();
      ctx.arc(r.x + 24 + 36 * v.knob[line], r.y + r.h / 2, 17, 0, Math.PI * 2);
      ctx.fillStyle = on ? c['--accent'] : c['--muted'];
      ctx.fill();
      label(ctx, c, SWITCH_LABEL[line], r.x + r.w / 2, r.y - 12);
    }
  }
}

const grow = (r: { x: number; y: number; w: number; h: number }, n: number) => ({ x: r.x - n, y: r.y - n, w: r.w + 2 * n, h: r.h + 2 * n });

function path(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string, width: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, c: Theme, text: string, x: number, y: number): void {
  ctx.fillStyle = c['--muted'];
  ctx.font = `600 13px ${c['--ui']}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}
