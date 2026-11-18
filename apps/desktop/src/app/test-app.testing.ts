// Test support only. Mounts the real routes with the real router and a fake gateway.
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { FakeGateway } from './workspaces/fake-gateway.testing';
import { memoryStorage } from './workspaces/fake-storage.testing';
import { LAST_LAB_STORAGE, type PointerStorage } from './workspaces/last-lab-pointer';
import { WORKSPACE_GATEWAY } from './workspaces/workspace-gateway';

export async function mount(gateway: FakeGateway, url: string, storage: PointerStorage | null = memoryStorage()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      { provide: WORKSPACE_GATEWAY, useValue: gateway },
      { provide: LAST_LAB_STORAGE, useValue: storage },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return harness;
}

/** Waits for queued promise callbacks and re-renders. */
export async function settle(harness: RouterTestingHarness) {
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }
}

export const root = (h: RouterTestingHarness) => h.fixture.nativeElement as HTMLElement;
export const q = <T extends Element = HTMLElement>(h: RouterTestingHarness, selector: string) => root(h).querySelector<T>(selector);
export const text = (h: RouterTestingHarness) => (root(h).textContent ?? '').replace(/\s+/g, ' ').trim();
export function button(h: RouterTestingHarness, label: string) {
  const b = [...root(h).querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === label);
  if (!b) throw new Error(`no button "${label}" in: ${text(h)}`);
  return b;
}
export function type(h: RouterTestingHarness, value: string) {
  const input = q<HTMLInputElement>(h, 'input')!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
