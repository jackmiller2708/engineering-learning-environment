import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { HOST_PATH_MESSAGE, HOST_SENTINEL, KNOWN_HOST_MESSAGES, BANNED, rendered as renderedText, violations } from './copy-scan.testing';
import { button, mount, q, root, settle, type } from './test-app.testing';
import { WORKSPACE_GATEWAY } from './workspaces/workspace-gateway';
import { LAST_LAB_STORAGE, POINTER_KEY } from './workspaces/last-lab-pointer';
import { memoryStorage } from './workspaces/fake-storage.testing';
import { FakeGateway, ID_A, ID_B, ID_C, deferred, failure, invalid, listOf, valid, type ListResult } from './workspaces/fake-gateway.testing';

const APP = 'Engineering Learning Environment';
/** A fresh test module, for the cases that mount several screens in one test. */
const fresh = (...args: Parameters<typeof mount>) => {
  TestBed.resetTestingModule();
  return mount(...args);
};
const go = async (h: Awaited<ReturnType<typeof mount>>, url: string) => {
  await TestBed.inject(Router).navigateByUrl(url);
  await settle(h);
};
const gatewayOf = (...entries: Parameters<typeof listOf>) => {
  const g = new FakeGateway();
  g.onList = async () => listOf(...entries);
  return g;
};

describe('document.title', () => {
  it('is the product name alone for the launch route', async () => {
    const g = new FakeGateway();
    g.onList = () => deferred<ListResult>().promise; // launch stays pending
    await mount(g, '/', memoryStorage({ [POINTER_KEY]: ID_A }));
    expect(document.title).toBe(APP);
  });

  it('is "Worlds — …" on /worlds', async () => {
    const h = await mount(gatewayOf(), '/worlds');
    await settle(h);
    expect(document.title).toBe(`Worlds — ${APP}`);
  });

  it('names the loaded lab, the world and the product for a ready lab', async () => {
    const h = await mount(gatewayOf(valid(ID_A, 'Half adder')), `/workspace/${ID_A}`);
    await settle(h);
    expect(document.title).toBe(`Half adder — Computer Foundations — ${APP}`);
  });

  it('is set by a restore from launch, to the restored lab', async () => {
    const h = await mount(gatewayOf(valid(ID_A, 'Half adder')), '/', memoryStorage({ [POINTER_KEY]: ID_A }));
    await settle(h);
    expect(document.title).toBe(`Half adder — Computer Foundations — ${APP}`);
  });

  it.each([
    ['not found', () => gatewayOf(valid(ID_B, 'Other')), `/workspace/${ID_A}`, 'Lab not found'],
    ['a bad address', () => gatewayOf(), '/workspace/not-a-uuid', 'Not a lab address'],
    ['an unopenable lab', () => gatewayOf(invalid(ID_A)), `/workspace/${ID_A}`, 'This lab cannot be opened'],
    ['an unreadable lab', () => gatewayOf(invalid(ID_A, 'entry_unreadable')), `/workspace/${ID_A}`, 'This lab could not be read'],
    [
      'a failed read',
      () => {
        const g = new FakeGateway();
        g.onList = async () => failure('storage_unavailable', 'x');
        return g;
      },
      `/workspace/${ID_A}`,
      'This lab could not be loaded',
    ],
  ])('is the state heading for %s', async (_l, make, url, heading) => {
    const h = await mount(make(), url);
    await settle(h);
    expect(document.title).toBe(`${heading} — ${APP}`);
    expect(q(h, 'h1')?.textContent).toBe(heading); // the same words the screen shows
  });

  it('is the generic title while a lab loads, and never the previous lab\'s name', async () => {
    const g = gatewayOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta'));
    const h = await mount(g, `/workspace/${ID_A}`);
    await settle(h);
    expect(document.title).toBe(`Alpha — Computer Foundations — ${APP}`);
    const pending = deferred<ListResult>();
    g.onList = () => pending.promise;
    await TestBed.inject(Router).navigateByUrl(`/workspace/${ID_B}`);
    await settle(h);
    expect(document.title).toBe(APP); // Beta is still resolving; Alpha must not show
    pending.resolve(listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta')));
    await settle(h);
    expect(document.title).toBe(`Beta — Computer Foundations — ${APP}`);
  });

  it('does not take the title of a lab that was left before it resolved', async () => {
    const g = new FakeGateway();
    const first = deferred<ListResult>();
    g.onList = () => first.promise;
    const h = await mount(g, `/workspace/${ID_A}`);
    g.onList = async () => listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta'));
    await go(h, `/workspace/${ID_B}`);
    expect(document.title).toBe(`Beta — Computer Foundations — ${APP}`);
    first.resolve(listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta'))); // the stale answer arrives late
    await settle(h);
    expect(document.title).toBe(`Beta — Computer Foundations — ${APP}`);
  });

  it('follows navigation from a lab to Worlds and back', async () => {
    const h = await mount(gatewayOf(valid(ID_A, 'Alpha')), `/workspace/${ID_A}`);
    await settle(h);
    await go(h, '/worlds');
    expect(document.title).toBe(`Worlds — ${APP}`);
    await go(h, `/workspace/${ID_A}`);
    expect(document.title).toBe(`Alpha — Computer Foundations — ${APP}`);
  });

  describe('Try again', () => {
    const failing = () => {
      const g = gatewayOf();
      g.onList = async () => failure('storage_unavailable', 'x');
      return g;
    };

    it('keeps the error title while the retry resolves, then becomes the lab\'s title', async () => {
      const g = failing();
      const h = await mount(g, `/workspace/${ID_A}`);
      await settle(h);
      expect(document.title).toBe(`This lab could not be loaded — ${APP}`);
      const pending = deferred<ListResult>();
      g.onList = () => pending.promise;
      button(h, 'Try again').click();
      await settle(h);
      expect(q(h, 'h1')).toBeNull(); // really loading
      expect(document.title).toBe(`This lab could not be loaded — ${APP}`); // retained
      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await settle(h);
      expect(document.title).toBe(`Alpha — Computer Foundations — ${APP}`);
    });

    it('becomes the new error title when the retry ends in a different error', async () => {
      const g = failing();
      const h = await mount(g, `/workspace/${ID_A}`);
      await settle(h);
      g.onList = async () => listOf(); // the lab is no longer listed
      button(h, 'Try again').click();
      await settle(h);
      expect(document.title).toBe(`Lab not found — ${APP}`);
    });

    it('stays the same error title when the retry fails the same way', async () => {
      const g = failing();
      const h = await mount(g, `/workspace/${ID_A}`);
      await settle(h);
      button(h, 'Try again').click();
      await settle(h);
      expect(document.title).toBe(`This lab could not be loaded — ${APP}`);
    });
  });

  // Not tested here: that the native window title stays as configured. `document.title` is the web document title and
  // cannot be shown to be independent of the native title by a unit test. That was observed in the built application
  // (STEP6_REPORT section 5) and is manual evidence only; there is no automated test of it.
});

describe('copy sweep', () => {
  const HOST = HOST_SENTINEL;
  const rendered = (h: Awaited<ReturnType<typeof mount>>) => renderedText(root(h));

  it.each([
    ['workspace', 'Open the Workspace folder'],
    ['workspace', 'workspaces'],
    ['manifest', 'The Manifest is invalid'],
    ['workspace.json', 'workspace.json is not valid'],
    ['an internal data-folder path', 'See /home/alice/data'],
    ['an internal data-folder path', 'C:\\Users\\a\\labs'],
    ['an internal data-folder path', 'dev.engineering-learning-environment.desktop'],
    ['a raw host message', `The application said: ${HOST}`],
  ])('the scanner detects %s in "%s" (so a clean result means something)', (name, sample) => {
    expect(violations(sample)).toContain(name);
  });

  it('does not ban ordinary words such as file and path', () => {
    expect(violations('The file path you chose is saved on this computer.')).toEqual([]);
  });

  describe('the raw-host-message and internal-path rules are independent (T2)', () => {
    it('the sentinel is not a path and contains no banned word, so only the host-message rule can catch it', () => {
      expect(violations(HOST_SENTINEL)).toEqual(['a raw host message']);
      expect(KNOWN_HOST_MESSAGES).toContain(HOST_SENTINEL);
    });

    it('a real path is caught by the path rule alone, and is not mistaken for the host message', () => {
      expect(violations(HOST_PATH_MESSAGE)).toEqual(['an internal data-folder path']);
    });

    it.each([
      ['an internal data-folder path', HOST_PATH_MESSAGE],
      ['a raw host message', HOST_SENTINEL],
    ])('with the "%s" rule removed, its own sample goes unnoticed by every other rule', (name, sample) => {
      expect(violations(sample, BANNED), 'the full list catches it').toEqual([name]);
      expect(violations(sample, BANNED.filter(([n]) => n !== name)), 'nothing else does').toEqual([]);
    });
  });

  it('really reads the page: it sees the screen text, the title and attributes, and a violation placed on the page is found', async () => {
    const h = await mount(gatewayOf(valid(ID_A, 'Half adder')), `/workspace/${ID_A}`);
    await settle(h);
    const text = rendered(h);
    expect(text).toContain('Change the bits and observe how each position contributes to the total.');
    expect(text).toContain(`Half adder — Computer Foundations — ${APP}`); // document.title
    expect(text.match(/Half adder/g)!.length).toBeGreaterThan(2); // heading, facts, title attribute, document.title
    q(h, 'main')!.append(Object.assign(document.createElement('p'), { textContent: 'workspace.json' }));
    q(h, 'main')!.setAttribute('aria-label', HOST);
    expect(violations(rendered(h))).toEqual(expect.arrayContaining(['workspace', 'workspace.json', 'a raw host message']));
  });

  const clean = (h: Awaited<ReturnType<typeof mount>>, label: string) => {
    const text = rendered(h);
    expect(text.length, `${label}: nothing rendered`).toBeGreaterThan(30);
    expect(violations(text), `${label}: ${text}`).toEqual([]);
  };

  it('Worlds: loading, empty, populated with every unopenable kind, and failed', async () => {
    const pending = deferred<ListResult>();
    const g = new FakeGateway();
    g.onList = () => pending.promise;
    const h = await mount(g, '/worlds');
    await settle(h);
    clean(h, 'worlds loading');
    pending.resolve(listOf());
    await settle(h);
    expect(rendered(h)).toContain('You have no labs in this world yet.');
    clean(h, 'worlds empty');

    const kinds = ['entry_symlink', 'manifest_missing', 'manifest_not_a_file', 'manifest_too_large', 'manifest_not_utf8',
      'manifest_malformed', 'manifest_invalid_field', 'manifest_id_mismatch', 'manifest_unsupported_version', 'entry_unreadable', 'kind_from_the_future'];
    const g2 = gatewayOf(valid(ID_A, 'Half adder'), ...kinds.map((k, i) => invalid(`aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, k, HOST)));
    const h2 = await fresh(g2, '/worlds');
    await settle(h2);
    expect(rendered(h2)).toContain('Cannot be opened');
    clean(h2, 'worlds populated');

    for (const kind of ['storage_unavailable', 'internal_error', 'something_new']) {
      const g3 = new FakeGateway();
      g3.onList = async () => failure(kind, HOST);
      const h3 = await fresh(g3, '/worlds');
      await settle(h3);
      expect(rendered(h3)).toContain('Try again');
      clean(h3, `worlds failed ${kind}`);
    }
  });

  it.each([
    ['no pointer is not shown', null, undefined],
    ['an absent lab', ID_C, () => gatewayOf(valid(ID_A, 'Half adder'))],
    ['an invalid lab', ID_A, () => gatewayOf(invalid(ID_A, 'manifest_malformed', HOST))],
    ['an unreadable lab', ID_A, () => gatewayOf(invalid(ID_A, 'entry_unreadable', HOST))],
    [
      'a failed listing',
      ID_A,
      () => {
        const g = new FakeGateway();
        g.onList = async () => failure('storage_unavailable', HOST);
        return g;
      },
    ],
  ])('recovery notices after launch: %s', async (_l, pointer, make) => {
    const h = await mount(make ? make() : gatewayOf(valid(ID_A, 'Half adder')), '/', memoryStorage(pointer ? { [POINTER_KEY]: pointer } : {}));
    await settle(h);
    expect(TestBed.inject(Router).url).toBe('/worlds');
    // A failed listing is explained by Worlds' own failure panel rather than a notice (Step 4).
    if (pointer) expect((q(h, '.notice') ?? q(h, '[role=alert]'))?.textContent, 'feedback was really shown').toBeTruthy();
    clean(h, `launch ${_l}`);
  });

  it('creation feedback: success, every failure kind, and an unconfirmed create', async () => {
    const kinds = ['name_empty', 'name_control_character', 'name_too_long', 'id_collision', 'id_unavailable', 'clock_before_epoch',
      'clock_out_of_range', 'storage_unavailable', 'storage_write_failed', 'storage_publish_failed', 'storage_unsupported', 'internal_error', 'unexpected_error', 'from_the_future'];
    const h = await mount(gatewayOf(), '/worlds');
    await settle(h);
    type(h, 'Half adder');
    q(h, 'form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(h);
    expect(rendered(h)).toContain('Created “Half adder”.');
    clean(h, 'create success');
    for (const kind of kinds) {
      const gw = gatewayOf();
      gw.onCreate = async () => failure(kind, HOST) as never;
      const hh = await fresh(gw, '/worlds');
      await settle(hh);
      type(hh, 'Half adder');
      q(hh, 'form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(hh);
      expect(q(hh, '[role=alert]')?.textContent, `${kind}: an error was really shown`).toBeTruthy();
      clean(hh, `create failure ${kind}`);
    }
  });

  it('every lab state: loading, ready, bad address, not found, unopenable (all kinds), unreadable, failed', async () => {
    const pending = deferred<ListResult>();
    const gl = new FakeGateway();
    gl.onList = () => pending.promise;
    const hl = await mount(gl, `/workspace/${ID_A}`);
    await settle(hl);
    expect(q(hl, 'main')?.getAttribute('aria-busy')).toBe('true');
    clean(hl, 'lab loading');

    const h = await fresh(gatewayOf(valid(ID_A, 'Half adder')), `/workspace/${ID_A}`);
    await settle(h);
    clean(h, 'lab ready');

    const hb = await fresh(gatewayOf(), '/workspace/not-a-uuid');
    await settle(hb);
    clean(hb, 'bad address');
    const hn = await fresh(gatewayOf(), `/workspace/${ID_A}`);
    await settle(hn);
    clean(hn, 'not found');

    for (const kind of ['entry_symlink', 'manifest_missing', 'manifest_not_a_file', 'manifest_too_large', 'manifest_not_utf8', 'manifest_malformed',
      'manifest_invalid_field', 'manifest_id_mismatch', 'manifest_unsupported_version', 'entry_unreadable', 'kind_from_the_future']) {
      const hu = await fresh(gatewayOf(invalid(ID_A, kind, HOST)), `/workspace/${ID_A}`);
      await settle(hu);
      expect(q(hu, 'h1')?.textContent).toMatch(/^This lab (cannot be opened|could not be read)$/);
      clean(hu, `unopenable ${kind}`);
    }
    for (const kind of ['storage_unavailable', 'internal_error', 'something_new']) {
      const g = new FakeGateway();
      g.onList = async () => failure(kind, HOST);
      const hf = await fresh(g, `/workspace/${ID_A}`);
      await settle(hf);
      expect(q(hf, 'h1')?.textContent).toBe('This lab could not be loaded');
      clean(hf, `failed ${kind}`);
    }
  });
});

describe('copy sweep: the whole application shell (T1)', () => {
  /** The real shell around the real routes, so the skip link, brand, breadcrumb and status region are in the page. */
  async function shell(gateway: FakeGateway, url: string, storage = memoryStorage()) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: WORKSPACE_GATEWAY, useValue: gateway },
        { provide: LAST_LAB_STORAGE, useValue: storage },
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(url);
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture.nativeElement as HTMLElement;
  }
  /** What the shell tests scan: the whole application element, not only the routed screen. */
  const shellText = (el: HTMLElement) => renderedText(el);
  const pendingGateway = () => {
    const g = new FakeGateway();
    g.onList = () => deferred<ListResult>().promise;
    return g;
  };
  const assertClean = (el: HTMLElement, label: string) => {
    const text = shellText(el);
    expect(text.length, `${label}: nothing rendered`).toBeGreaterThan(60);
    expect(violations(text), `${label}: ${text}`).toEqual([]);
  };

  it('covers the skip link, brand, breadcrumb (world and active lab), labels and routed content on a ready lab', async () => {
    const el = await shell(gatewayOf(valid(ID_A, 'Half adder')), `/workspace/${ID_A}`);
    const text = shellText(el);
    for (const expected of ['Skip to main content', APP, 'You are here', 'Worlds', 'Computer Foundations', 'Half adder', ID_A.slice(0, 8), 'Starting example'])
      expect(text, `the scan sees "${expected}"`).toContain(expected);
    assertClean(el, 'ready lab with shell');
  });

  it('covers the shell on Worlds', async () => {
    const el = await shell(gatewayOf(valid(ID_A, 'Half adder')), '/worlds');
    expect(shellText(el)).toContain('Skip to main content');
    expect(shellText(el)).toContain('Create new lab');
    assertClean(el, 'worlds with shell');
  });

  it('covers the shell status messages: "Opening lab…" and "Opening your last lab…"', async () => {
    const lab = await shell(pendingGateway(), `/workspace/${ID_A}`);
    expect(lab.querySelector('[role=status]')?.textContent).toContain('Opening lab…');
    expect(shellText(lab)).toContain('Opening lab…');
    assertClean(lab, 'lab loading with shell');

    const launch = await shell(pendingGateway(), '/', memoryStorage({ [POINTER_KEY]: ID_A }));
    expect(launch.querySelector('[role=status]')?.textContent).toContain('Opening your last lab…');
    expect(shellText(launch)).toContain('Opening your last lab…');
    assertClean(launch, 'launch loading with shell');
  });

  it.each([HOST_SENTINEL, HOST_PATH_MESSAGE])('shows no raw host message in the shell or the screen for failed states (%s)', async (message) => {
    const failing = () => {
      const g = new FakeGateway();
      g.onList = async () => failure('storage_unavailable', message);
      return g;
    };
    assertClean(await shell(failing(), '/worlds'), 'worlds list failed');
    assertClean(await shell(failing(), `/workspace/${ID_A}`), 'lab failed read');
    assertClean(await shell(gatewayOf(invalid(ID_A, 'manifest_malformed', message)), `/workspace/${ID_A}`), 'lab unopenable');
    assertClean(await shell(gatewayOf(invalid(ID_A, 'manifest_malformed', message)), '/worlds'), 'worlds unopenable entry');
    assertClean(await shell(gatewayOf(invalid(ID_A, 'entry_unreadable', message)), '/', memoryStorage({ [POINTER_KEY]: ID_A })), 'launch unreadable');
  });

  describe('a prohibited term in shell content is detected, and a routed-screen-only scan would miss it', () => {
    const word = 'workspace';
    it.each([
      ['the skip link text', (el: HTMLElement) => void (el.querySelector('a.skip')!.textContent = `Skip to ${word}`)],
      ['the application brand', (el: HTMLElement) => void (el.querySelector('.brand')!.textContent = `The ${word} app`)],
      ['a breadcrumb label', (el: HTMLElement) => void el.querySelector('nav')!.setAttribute('aria-label', `${word} trail`)],
      ['the world breadcrumb item', (el: HTMLElement) => void (el.querySelector('nav .crumb')!.textContent = word)],
      ['the shell status message', (el: HTMLElement) => void (el.querySelector('[role=status]')!.textContent = `Opening ${word}…`)],
    ])('%s', async (_name, inject) => {
      const el = await shell(gatewayOf(valid(ID_A, 'Half adder')), `/workspace/${ID_A}`);
      expect(violations(shellText(el))).toEqual([]);
      inject(el);
      expect(violations(shellText(el))).toContain('workspace');
      // The routed screen alone does not contain the shell, so scanning only it passes this violation:
      expect(violations(renderedText(el.querySelector<HTMLElement>('.content')!))).toEqual([]);
    });

    it('the host message and an internal path placed in the shell are detected too', async () => {
      const el = await shell(gatewayOf(valid(ID_A, 'Half adder')), '/worlds');
      el.querySelector('.brand')!.setAttribute('title', HOST_SENTINEL);
      expect(violations(shellText(el))).toEqual(['a raw host message']);
      el.querySelector('.brand')!.setAttribute('title', HOST_PATH_MESSAGE);
      expect(violations(shellText(el))).toEqual(['an internal data-folder path']);
    });
  });
});
