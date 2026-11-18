import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalRelayExperiment } from './signal-relay-experiment';
import { SWITCHES } from './relay-layout';
import { viewOf, type RelayView } from './relay-view';

const ONLINE = 'Beacon online. Outpost connection restored.';

let gradients = 0;
const context = new Proxy({} as Record<string, unknown>, {
  get: (t, k: string) => {
    if (k === 'createRadialGradient') return () => (gradients++, { addColorStop() {} });
    return k in t ? t[k] : () => undefined;
  },
  set: (t, k: string, v) => ((t[k] = v), true),
});

beforeEach(() => {
  gradients = 0;
  // Reduced motion: every change is instant, so the tests are about state, not timing.
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as never);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 480, height: 260, right: 480, bottom: 260, x: 0, y: 0, toJSON() {} });
});
afterEach(() => vi.restoreAllMocks());

async function open() {
  const fixture = TestBed.createComponent(SignalRelayExperiment);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const status = () => el.querySelector('.status')!.textContent!.trim();
  const choose = async (name: 'SVG' | 'Canvas') => {
    [...el.querySelectorAll<HTMLButtonElement>('.choice button')].find((b) => b.textContent!.trim() === name)!.click();
    await settle();
  };
  // Each renderer's own native way of flipping a switch.
  const svgFlip = async (line: 'a' | 'b') => {
    el.querySelector<SVGGElement>(`g.switch[aria-label="Line ${line.toUpperCase()}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  };
  const canvasFlip = async (line: 'a' | 'b') => {
    const r = SWITCHES[line];
    el.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: r.x + r.w / 2, clientY: r.y + r.h / 2, bubbles: true }));
    await settle();
  };
  const reset = async () => {
    [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Reset')!.click();
    await settle();
  };
  return { fixture, el, status, choose, svgFlip, canvasFlip, reset, settle };
}

describe('the relay experiment', () => {
  it('opens with the situation, a dark beacon and the SVG renderer', async () => {
    const h = await open();
    expect(h.el.querySelector('h1')!.textContent).toBe('Remote relay');
    expect(h.status()).toBe('Signal lost');
    expect(h.el.textContent).toContain('An outpost beacon has gone dark. Two supply lines feed its relay. Restore the signal.');
    expect(h.el.querySelector('app-relay-svg')).not.toBeNull();
    expect(h.el.querySelector('app-relay-canvas')).toBeNull();
  });

  it('has no prediction field, quiz, score or completion marker, and does not name the gate', async () => {
    const h = await open();
    await h.svgFlip('a');
    await h.svgFlip('b');
    expect(h.el.querySelector('input, textarea, select')).toBeNull();
    expect(h.el.textContent).not.toMatch(/\b(score|points?|streak|grade|badge|correct|wrong|and gate|AND|complete[d]?|\d+%)\b/);
  });

  it('keeps the hint optional and hidden until asked for', async () => {
    const h = await open();
    expect(h.el.querySelector('.hint')).toBeNull();
    [...h.el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Hint')!.click();
    await h.settle();
    expect(h.el.querySelector('.hint')!.textContent).toBe('Try every combination of the two switches.');
  });

  describe.each([
    ['SVG', (h: Awaited<ReturnType<typeof open>>) => h.svgFlip],
    ['Canvas', (h: Awaited<ReturnType<typeof open>>) => h.canvasFlip],
  ] as const)('with the %s renderer', (name, flipper) => {
    it('lights the beacon only when both lines are on, and Reset darkens it', async () => {
      const h = await open();
      await h.choose(name);
      const flip = flipper(h);
      const seen: string[] = [];
      for (const step of ['a', 'b', 'a', 'a', 'b', 'a', 'b'] as const) {
        await flip(step);
        seen.push(h.status() === ONLINE ? 'on' : 'off');
      }
      // a on | +b: both | a off | a on: both | b off | a off | b on: only b
      expect(seen).toEqual(['off', 'on', 'off', 'on', 'off', 'off', 'off']);
      await flip('a');
      await flip('b');
      await h.reset();
      expect(h.status()).toBe('Signal lost');
    });
  });

  it('shows the same behaviour for every combination in both renderers', async () => {
    const combos = [[], ['a'], ['b'], ['a', 'b']] as const;
    for (const on of combos) {
      const result: Record<string, string> = {};
      for (const name of ['SVG', 'Canvas'] as const) {
        TestBed.resetTestingModule();
        const h = await open();
        await h.choose(name);
        for (const line of on) await (name === 'SVG' ? h.svgFlip : h.canvasFlip)(line);
        result[name] = h.status();
      }
      expect(result['Canvas'], `lines ${on.join('+') || 'none'}`).toBe(result['SVG']);
      expect(result['SVG']).toBe(on.length === 2 ? ONLINE : 'Signal lost');
    }
  });

  it('draws the lit beacon in each renderer from the same state (SVG halo element, Canvas halo gradient)', async () => {
    const h = await open();
    await h.svgFlip('a');
    await h.svgFlip('b');
    expect(h.el.querySelector('.halo')).not.toBeNull();
    await h.choose('Canvas');
    await h.settle();
    expect(gradients).toBeGreaterThan(0); // the canvas drew the beacon glow for the shared state
    await h.reset();
    const before = gradients;
    await h.settle();
    expect(gradients).toBe(before); // dark again: no glow drawn
  });

  it('keeps the circuit state when the renderer is switched', async () => {
    const h = await open();
    const checkedNow = () => [...h.el.querySelectorAll('g.switch')].map((g) => g.getAttribute('aria-checked'));
    expect(checkedNow()).toEqual(['false', 'false']);
    await h.svgFlip('a');
    expect(checkedNow()).toEqual(['true', 'false']);
    await h.choose('Canvas');
    await h.canvasFlip('b');
    expect(h.status()).toBe(ONLINE);
    await h.choose('SVG');
    expect(h.status()).toBe(ONLINE);
    const checked = [...h.el.querySelectorAll('g.switch')].map((g) => g.getAttribute('aria-checked'));
    expect(checked).toEqual(['true', 'true']);
  });

  it('shows the canvas focus ring for keyboard use only, never after a mouse press', async () => {
    const h = await open();
    await h.choose('Canvas');
    const c = h.el.querySelector('canvas')!;
    const ring = () =>
      (h.fixture.debugElement.query(By.css('app-relay-canvas')).componentInstance as unknown as { ring(): boolean }).ring();
    const r = SWITCHES.a;
    // A mouse press focuses the canvas (as a browser does) and operates the switch: no ring.
    c.dispatchEvent(new MouseEvent('pointerdown', { clientX: r.x + 5, clientY: r.y + 5, bubbles: true }));
    c.dispatchEvent(new Event('focus'));
    c.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(ring()).toBe(false);
    // Leaving and tabbing back in is keyboard focus: ring.
    c.dispatchEvent(new Event('blur'));
    c.dispatchEvent(new Event('focus'));
    expect(ring()).toBe(true);
    // Using the arrow keys keeps it; a later press removes it.
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(ring()).toBe(true);
    c.dispatchEvent(new MouseEvent('pointerdown', { clientX: r.x + 5, clientY: r.y + 5, bubbles: true }));
    expect(ring()).toBe(false);
    // Keys after a press bring it back and still work: Space flips the selected switch.
    c.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(ring()).toBe(true);
  });

  it('ignores a canvas press away from the switches', async () => {
    const h = await open();
    await h.choose('Canvas');
    h.el.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: 240, clientY: 10, bubbles: true }));
    await h.settle();
    h.el.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: 240, clientY: 250, bubbles: true }));
    await h.canvasFlip('a');
    expect(h.status()).toBe('Signal lost'); // only A is on
  });

  it('flips switches from the keyboard in both renderers', async () => {
    const h = await open();
    const g = (label: string) => h.el.querySelector<SVGGElement>(`g.switch[aria-label="${label}"]`)!;
    g('Line A').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    g('Line B').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await h.settle();
    expect(h.status()).toBe(ONLINE);

    await h.reset();
    await h.choose('Canvas');
    const c = h.el.querySelector('canvas')!;
    c.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); // starts on Line A
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    c.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await h.settle();
    expect(h.status()).toBe(ONLINE);
  });
});

describe('the relay experiment with motion on', () => {
  let clock = 0;
  // Angular schedules its own frames too, so keep every callback and run them all, not just the last.
  let frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    clock = 1000;
    frames = [];
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (frames.push(cb), 1));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as never);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 480, height: 260, right: 480, bottom: 260, x: 0, y: 0, toJSON() {} });
  });

  async function start() {
    const fixture = TestBed.createComponent(SignalRelayExperiment);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const view = () => (fixture.debugElement.query(By.css('app-relay-svg, app-relay-canvas')).componentInstance as { view(): RelayView }).view();
    const flip = (label: string) => {
      el.querySelector<SVGGElement>(`g.switch[aria-label="${label}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
    };
    /** Moves the clock to `ms` after the start and runs the animation frame that would fire. */
    const at = (ms: number) => {
      clock = 1000 + ms;
      const due = frames;
      frames = [];
      due.forEach((cb) => cb(clock));
      fixture.detectChanges();
    };
    const reset = () => {
      [...el.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Reset')!.click();
      fixture.detectChanges();
    };
    const choose = (name: 'SVG' | 'Canvas') => {
      [...el.querySelectorAll<HTMLButtonElement>('.choice button')].find((b) => b.textContent!.trim() === name)!.click();
      fixture.detectChanges();
    };
    return { view, flip, at, reset, choose, el };
  }

  it('does not jump when a second switch is flipped mid-propagation', async () => {
    const h = await start();
    h.flip('Line A');
    h.at(140); // halfway along A's wire
    const before = h.view();
    expect(before.a).toBeCloseTo(0.5);
    h.flip('Line B'); // interrupts at the same instant
    const after = h.view();
    expect(after.a).toBeCloseTo(before.a);
    expect(after.knob).toEqual(before.knob);
    expect(after.gate).toBe(before.gate);
    expect(after.beacon).toBe(before.beacon);
  });

  it('settles into the view of the actual circuit after rapid flips', async () => {
    const h = await start();
    for (const [t, line] of [[0, 'Line A'], [60, 'Line B'], [130, 'Line A'], [200, 'Line A'], [250, 'Line B'], [310, 'Line B'], [350, 'Line A'], [400, 'Line B']] as const) {
      h.at(t);
      h.flip(line);
    }
    // Eight flips: A twice net 0 (A,A,A,A? count them) -> A flipped 4 times (off), B flipped 4 times (off).
    h.at(5000);
    expect(h.view()).toEqual(viewOf({ a: false, b: false }));
  });

  it('reset during propagation heads back to dark from what is shown, with no jump, and ends dark', async () => {
    const h = await start();
    h.flip('Line A');
    h.flip('Line B');
    h.at(200);
    const shown = h.view();
    h.reset();
    const right = h.view();
    expect(right.a).toBeCloseTo(shown.a);
    expect(right.b).toBeCloseTo(shown.b);
    h.at(200 + 5000);
    expect(h.view()).toEqual(viewOf({ a: false, b: false }));
  });

  it('shows the same view in both renderers, mid-propagation', async () => {
    const h = await start();
    h.flip('Line A');
    h.at(100);
    const svg = JSON.stringify(h.view());
    h.choose('Canvas');
    expect(JSON.stringify(h.view())).toBe(svg);
    h.at(100); // same instant: still the same view
    expect(JSON.stringify(h.view())).toBe(svg);
  });
});
