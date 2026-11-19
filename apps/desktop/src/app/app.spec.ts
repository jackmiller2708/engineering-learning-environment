import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { FakeGateway, ID_A, ID_B, deferred, failure, listOf, valid, invalid, type ListResult } from './workspaces/fake-gateway.testing';
import { memoryStorage } from './workspaces/fake-storage.testing';
import { LAST_LAB_STORAGE, POINTER_KEY as LAST_LAB_STORAGE_KEY } from './workspaces/last-lab-pointer';
import { WORKSPACE_GATEWAY } from './workspaces/workspace-gateway';

let current: ReturnType<typeof TestBed.createComponent<App>>;

/** Lets queued promises finish and re-renders, as a real frame would. */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r));
    await current.whenStable();
    current.detectChanges();
  }
}

async function shell(url: string, gateway = new FakeGateway(), seed = true) {
  if (seed) gateway.onList = async () => listOf(valid(ID_A, 'Adder bench'), invalid('4f525f09-3c12-449f-872b-c148c25e63ba'));
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      { provide: WORKSPACE_GATEWAY, useValue: gateway },
      { provide: LAST_LAB_STORAGE, useValue: memoryStorage() },
    ],
  });
  const fixture = (current = TestBed.createComponent(App));
  await TestBed.inject(Router).navigateByUrl(url);
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return fixture.nativeElement as HTMLElement;
}

const items = (el: HTMLElement) => [...el.querySelectorAll('nav[aria-label="You are here"] ol > li')];

describe('App shell', () => {
  it('shows the product name in the bar and hosts the routed page', async () => {
    const el = await shell('/worlds');
    expect(el.querySelector('header')?.textContent).toContain('Engineering Learning Environment');
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('offers a skip link as the first focusable thing, which moves focus to the page content', async () => {
    const el = await shell('/worlds');
    const skip = el.querySelector<HTMLAnchorElement>('a.skip')!;
    expect(skip.textContent).toContain('Skip to main content');
    expect(el.querySelector('a, button, input')).toBe(skip);
    skip.click();
    expect(document.activeElement).toBe(el.querySelector('main'));
  });

  it('on Worlds the breadcrumb is only "Worlds", the current page and not a link', async () => {
    const el = await shell('/worlds');
    const li = items(el);
    expect(li.map((x) => x.textContent?.trim())).toEqual(['Worlds']);
    expect(li[0]!.querySelector('a')).toBeNull();
    expect(li[0]!.querySelector('[aria-current="page"]')).not.toBeNull();
  });

  it('on the Signal Relay experiment Worlds is a link to /worlds, and following it reaches Worlds', async () => {
    const el = await shell('/experiments/signal-relay');
    const li = items(el);
    expect(li.map((x) => x.textContent?.trim())).toEqual(['Worlds']);
    const link = li[0]!.querySelector<HTMLAnchorElement>('a.crumb')!;
    expect(link.getAttribute('href')).toBe('/worlds');
    expect(el.querySelector('nav[aria-label="You are here"] [aria-current]')).toBeNull();
    link.click();
    await flush();
    expect(TestBed.inject(Router).url).toBe('/worlds');
  });

  it('in a lab: Worlds is a link, the world is plain text, the lab is the current page', async () => {
    const el = await shell(`/workspace/${ID_A}`);
    const nav = el.querySelector('nav[aria-label="You are here"]')!;
    const li = items(el);
    expect(li.map((x) => x.textContent?.replace(/[\s/]+/g, ' ').trim())).toEqual(['Worlds', 'Computer Foundations', 'Adder bench 0a1b2c3d']);

    const worlds = nav.querySelector('a')!;
    expect(worlds.textContent?.trim()).toBe('Worlds');
    expect(worlds.getAttribute('href')).toBe('/worlds');
    expect(nav.querySelectorAll('a')).toHaveLength(1);

    const world = li[1]!;
    expect(world.querySelector('a, button, [tabindex], [role]')).toBeNull();
    expect(world.querySelector('[aria-current]')).toBeNull();

    const current = nav.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain('Adder bench');
  });

  it('while the lab is not known, the breadcrumb ends at the world and nothing is the current page', async () => {
    const el = await shell(`/workspace/${'4f525f09-3c12-449f-872b-c148c25e63ba'}`); // unopenable
    const nav = el.querySelector('nav[aria-label="You are here"]')!;
    expect(nav.textContent).toContain('Computer Foundations');
    expect(nav.querySelector('[aria-current]')).toBeNull();
    expect(nav.textContent).not.toContain('4f525f09');
  });

  it('drops the lab from the breadcrumb when the learner returns to Worlds', async () => {
    const el = await shell(`/workspace/${ID_A}`);
    expect(el.querySelector('nav[aria-label="You are here"]')!.textContent).toContain('Adder bench');
    await TestBed.inject(Router).navigateByUrl('/worlds');
    await flush();
    expect(el.querySelector('nav[aria-label="You are here"]')!.textContent).not.toContain('Adder bench');
  });

  it('never shows the previous lab\'s name under another lab\'s address, even while the new lab is still resolving', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta'));
    const el = await shell(`/workspace/${ID_A}`, gateway, false);
    const crumbs = () => el.querySelector('nav[aria-label="You are here"]')!.textContent!;
    expect(crumbs()).toContain('Alpha');

    const pending = deferred<ListResult>();
    gateway.onList = () => pending.promise;
    await TestBed.inject(Router).navigateByUrl(`/workspace/${ID_B}`);
    await flush();
    expect(crumbs()).not.toContain('Alpha');
    expect(crumbs()).toContain('Computer Foundations');
    expect(el.querySelector('nav[aria-label="You are here"] [aria-current]')).toBeNull();

    pending.resolve(listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta')));
    await flush();
    expect(crumbs()).toContain('Beta');
    expect(crumbs()).not.toContain('Alpha');
  });

  it('keeps the bar and breadcrumb visible while a lab is loading, with the loading text in the page', async () => {
    const gateway = new FakeGateway();
    const pending = deferred<ListResult>();
    gateway.onList = () => pending.promise;
    const el = await shell(`/workspace/${ID_A}`, gateway, false);
    expect(el.querySelector('header.bar')).not.toBeNull();
    const nav = el.querySelector('nav[aria-label="You are here"]')!;
    expect(nav.textContent).toContain('Computer Foundations');
    expect(nav.querySelector('[aria-current]')).toBeNull(); // the lab is not confirmed yet
    expect(el.querySelector('[role=status]')?.textContent).toContain('Opening lab…');
    expect(el.querySelector('a.skip')).not.toBeNull();
    pending.resolve(listOf(valid(ID_A, 'Alpha')));
    await flush();
    expect(nav.textContent).toContain('Alpha');
  });

  describe('the loading status region (one, in the shell, present before any lab starts loading)', () => {
    const regions = (el: HTMLElement) => el.querySelectorAll('[role=status]');

    /** Mounts only the shell, still on no route, so the region can be observed before a lab loads. */
    async function bare(gateway: FakeGateway) {
      TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter(routes, withComponentInputBinding()),
          { provide: WORKSPACE_GATEWAY, useValue: gateway },
          { provide: LAST_LAB_STORAGE, useValue: memoryStorage() },
        ],
      });
      current = TestBed.createComponent(App);
      current.detectChanges();
      return current.nativeElement as HTMLElement;
    }
    const go = async (url: string) => {
      await TestBed.inject(Router).navigateByUrl(url);
      await flush();
    };

    it('exists, empty, before any lab begins to load', async () => {
      const el = await bare(new FakeGateway());
      expect(regions(el)).toHaveLength(1);
      expect(regions(el)[0]!.textContent?.trim()).toBe('');
      expect(regions(el)[0]!.closest('header, main, .content')).toBeNull(); // the shell's own, outside the routed screen
    });

    it('is the same element when the first lab navigation writes "Opening lab…" into it, and when loading ends', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const el = await bare(gateway);
      const region = regions(el)[0]!;

      await go(`/workspace/${ID_A}`);
      expect(regions(el)).toHaveLength(1);
      expect(regions(el)[0]).toBe(region); // not replaced
      expect(region.isConnected).toBe(true);
      expect(region.textContent).toContain('Opening lab…');

      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await flush();
      expect(regions(el)[0]).toBe(region);
      expect(region.isConnected).toBe(true);
      expect(region.textContent?.trim()).toBe(''); // cleared, not removed
    });

    it('has the text appear as a change of the existing node, which is what a live region announces', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const el = await bare(gateway);
      const seen: string[] = [];
      const observer = new MutationObserver(() => seen.push(regions(el)[0]!.textContent ?? ''));
      observer.observe(regions(el)[0]!, { childList: true, characterData: true, subtree: true });
      await go(`/workspace/${ID_A}`);
      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await flush();
      await new Promise((r) => setTimeout(r)); // observers run as microtasks; give them a turn
      observer.disconnect();
      expect(seen.some((t) => t.includes('Opening lab…'))).toBe(true);
      expect(seen[seen.length - 1]!.trim()).toBe('');
    });

    it('is reused by a retry, and is the only status region on the lab screen at every step', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => failure('storage_unavailable', 'x');
      const el = await bare(gateway);
      const region = regions(el)[0]!;
      await go(`/workspace/${ID_A}`);
      expect(regions(el)).toHaveLength(1);
      expect(region.textContent?.trim()).toBe(''); // failed: nothing is loading

      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Try again')!.click();
      await flush();
      expect(regions(el)).toHaveLength(1);
      expect(regions(el)[0]).toBe(region);
      expect(region.textContent).toContain('Opening lab…');

      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await flush();
      expect(regions(el)).toHaveLength(1);
      expect(regions(el)[0]).toBe(region);
      expect(region.textContent?.trim()).toBe('');
    });

    it('does not say "Opening lab…" twice, and does not leave it behind on another screen', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      const el = await bare(gateway);
      await go(`/workspace/${ID_A}`);
      expect((el.textContent!.match(/Opening lab…/g) ?? []).length).toBe(0);
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      await go(`/workspace/${ID_B}`);
      expect((el.textContent!.match(/Opening lab…/g) ?? []).length).toBe(1); // the shell's region only
      await go('/worlds'); // leave while still loading
      expect(el.textContent).not.toContain('Opening lab…');
      expect(regions(el)[0]!.textContent?.trim()).not.toContain('Opening lab');
    });

    it('does not move focus when its text changes', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const el = await bare(gateway);
      const probe = document.createElement('button');
      document.body.appendChild(probe);
      probe.focus();
      await go(`/workspace/${ID_A}`);
      expect(regions(el)[0]!.textContent).toContain('Opening lab…');
      expect(document.activeElement).toBe(probe);
      probe.remove();
    });

    it('keeps the lab screen\'s own layout: no region inside the routed screen, and aria-busy still set while loading', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const el = await bare(gateway);
      await go(`/workspace/${ID_A}`);
      expect(el.querySelector('app-lab-frame [role=status]')).toBeNull();
      expect(el.querySelector('app-lab-frame main')?.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('the launch resolver and the shell status region', () => {
    const regions = (el: HTMLElement) => el.querySelectorAll('[role=status]');
    async function launch(gateway: FakeGateway, pointer: string | null) {
      TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter(routes, withComponentInputBinding()),
          { provide: WORKSPACE_GATEWAY, useValue: gateway },
          { provide: LAST_LAB_STORAGE, useValue: memoryStorage(pointer ? { [LAST_LAB_STORAGE_KEY]: pointer } : {}) },
        ],
      });
      current = TestBed.createComponent(App);
      current.detectChanges();
      const el = current.nativeElement as HTMLElement;
      const region = regions(el)[0]!;
      await TestBed.inject(Router).navigateByUrl('/');
      return { el, region };
    }
    const url = () => TestBed.inject(Router).url;

    it('writes into the shell region that was there before launch began, and clears it without removing it', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const { el, region } = await launch(gateway, ID_A);
      expect(region.textContent?.trim()).toBe(''); // empty before it starts
      current.detectChanges();
      expect(regions(el)).toHaveLength(1);
      expect(regions(el)[0]).toBe(region);
      expect(region.textContent).toContain('Opening your last lab…');
      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await flush();
      expect(url()).toBe(`/workspace/${ID_A}`);
      expect(regions(el)[0]).toBe(region);
      expect(region.isConnected).toBe(true);
      expect(region.textContent?.trim()).toBe('');
    });

    it('has no region of its own: one status region while the resolver is on screen', async () => {
      const gateway = new FakeGateway();
      gateway.onList = () => deferred<ListResult>().promise;
      const { el } = await launch(gateway, ID_A);
      current.detectChanges();
      expect(regions(el)).toHaveLength(1);
      expect(el.querySelector('app-launch-resolver [role=status]')).toBeNull();
      expect((el.textContent!.match(/Opening your last lab…/g) ?? []).length).toBe(1);
    });

    it.each([
      ['a failed listing', () => { const g = new FakeGateway(); g.onList = async () => failure('storage_unavailable', 'x'); return g; }, ID_A, '/worlds'],
      ['a lab that is gone', () => { const g = new FakeGateway(); g.onList = async () => listOf(valid(ID_B, 'Beta')); return g; }, ID_A, '/worlds'],
      ['an invalid lab', () => { const g = new FakeGateway(); g.onList = async () => listOf(invalid(ID_A)); return g; }, ID_A, '/worlds'],
      ['no pointer', () => { const g = new FakeGateway(); g.onList = async () => listOf(); return g; }, null, '/worlds'],
    ])('clears the message and keeps the same element when %s sends the learner to Worlds', async (_l, make, pointer, target) => {
      const { el, region } = await launch(make(), pointer);
      await flush();
      expect(url()).toBe(target);
      expect([...regions(el)].filter((r) => !r.closest('.content'))).toEqual([region]); // the shell's one region; Worlds' own regions are inside the routed page
      expect(region.isConnected).toBe(true);
      expect(region.textContent?.trim()).toBe('');
    });

    it('leaves no stale text when the learner leaves while the resolution is pending', async () => {
      const gateway = new FakeGateway();
      gateway.onList = () => deferred<ListResult>().promise;
      const { el, region } = await launch(gateway, ID_A);
      current.detectChanges();
      expect(region.textContent).toContain('Opening your last lab…');
      await TestBed.inject(Router).navigateByUrl('/worlds');
      await flush();
      expect(region.isConnected).toBe(true);
      expect(el.textContent).not.toContain('Opening your last lab…');
    });

    it('moves focus to the restored lab heading and not on the status text change', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      const probe = document.createElement('button');
      document.body.appendChild(probe);
      probe.focus();
      const { el } = await launch(gateway, ID_A);
      current.detectChanges();
      expect(document.activeElement).toBe(probe); // writing the text moved nothing
      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await flush();
      expect(document.activeElement).toBe(el.querySelector('app-lab-frame h1'));
      probe.remove();
    });
  });

  describe('a lab that is left before it is ready (D1)', () => {
    it('changes nothing when its late result arrives: not the title, the pointer, the breadcrumb or the page', async () => {
      const storage = memoryStorage({ [LAST_LAB_STORAGE_KEY]: ID_B });
      const gateway = new FakeGateway();
      const first = deferred<ListResult>();
      let calls = 0;
      gateway.onList = () => (++calls === 1 ? first.promise : Promise.resolve(listOf(valid(ID_A, 'Abandoned lab'), valid(ID_B, 'Other lab'))));
      TestBed.configureTestingModule({
        imports: [App],
        providers: [
          provideRouter(routes, withComponentInputBinding()),
          { provide: WORKSPACE_GATEWAY, useValue: gateway },
          { provide: LAST_LAB_STORAGE, useValue: storage },
        ],
      });
      current = TestBed.createComponent(App);
      current.detectChanges();
      const el = current.nativeElement as HTMLElement;
      const router = TestBed.inject(Router);

      await router.navigateByUrl(`/workspace/${ID_A}`);
      await flush();
      expect(el.querySelector('app-lab-frame main')?.getAttribute('aria-busy')).toBe('true'); // still loading
      expect(el.querySelector('[role=status]')?.textContent).toContain('Opening lab…');

      await router.navigateByUrl('/worlds');
      await flush();
      const before = {
        title: document.title,
        text: el.textContent,
        bar: el.querySelector('header')?.textContent,
        status: el.querySelector('[role=status]')?.textContent,
        pointer: storage.data.get(LAST_LAB_STORAGE_KEY),
      };
      expect(before.title).toBe('Worlds — Engineering Learning Environment');
      expect(before.pointer).toBe(ID_B);

      first.resolve(listOf(valid(ID_A, 'Abandoned lab'), valid(ID_B, 'Other lab'))); // the old operation completes
      await flush();

      expect(document.title).toBe(before.title);
      expect(storage.data.get(LAST_LAB_STORAGE_KEY)).toBe(ID_B); // not the abandoned lab, and not cleared
      expect(el.querySelector('header')?.textContent).toBe(before.bar); // no stale lab in the breadcrumb
      expect(el.querySelector('header')?.textContent).not.toContain('Abandoned lab');
      expect(el.querySelector('[role=status]')?.textContent).toBe(before.status);
      expect(el.textContent).toBe(before.text); // nothing else on the page changed
      expect(router.url).toBe('/worlds');
      expect(el.querySelector('app-lab-frame')).toBeNull();
    });
  });

  it('uses system fonts only: no @font-face anywhere in the document styles', async () => {
    await shell('/worlds');
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    expect(css).not.toContain('@font-face');
  });
});
