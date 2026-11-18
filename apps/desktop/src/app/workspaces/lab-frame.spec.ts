import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Router } from '@angular/router';
import { mount, button, q, root, settle, text } from '../test-app.testing';
import { StatusMessage } from '../status-message';
import { FakeGateway, ID_A, ID_B, ID_C, deferred, failure, invalid, listOf, valid, type ListResult } from './fake-gateway.testing';
import { memoryStorage } from './fake-storage.testing';
import { POINTER_KEY } from './last-lab-pointer';
import { formatCreated, formatCreatedLocal, localOffsetLabel } from './workspace-format';

const withTwo = () => {
  const gateway = new FakeGateway();
  gateway.onList = async () => listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta', '2026-01-02T03:04:05Z'));
  return gateway;
};
const heading = (h: Parameters<typeof q>[0]) => q(h, 'h1');
const toWorlds = (h: Parameters<typeof q>[0]) => [...root(h).querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/worlds');

describe('Lab frame: ready', () => {
  it('shows the lab bar: the name as the heading, clamped with the full name in the title, and when it was created', async () => {
    const long = 'W'.repeat(64);
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(valid(ID_A, long, '2026-11-17T07:05:09Z'));
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    const h1 = heading(h)!;
    expect(h1.textContent).toBe(long);
    expect(h1.getAttribute('title')).toBe(long);
    expect(h1.getAttribute('dir')).toBe('auto');
    expect(q(h, '.labbar')!.contains(h1)).toBe(true);
    expect(q(h, '.labbar .meta')?.textContent).toMatch(/^Created \d{4}-\d{2}-\d{2} \d{2}:\d{2}( \(GMT[+-]?[\d:]*\))?$/);
  });

  it('shows the bench in the lab, on the dotted substrate, and draws no empty regions', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_A}`);
    await settle(h);
    const bench = q(h, 'section.benchwrap')!;
    expect(bench.getAttribute('aria-label')).toBe('Bench');
    expect(bench.querySelector('app-place-value-bench')).not.toBeNull();
    expect(text(h)).not.toContain('The bench is not available yet.');
    expect(root(h).querySelectorAll('.ghost, .diag, aside, [aria-label="Library"], [aria-label="Investigation"]')).toHaveLength(0);
  });

  it('shows the facts in their own row below the bench, never inside it: World, Lab, Created and the full ID', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_B}`);
    await settle(h);
    const bench = q(h, 'section.benchwrap')!;
    const dl = q(h, 'dl.facts')!;
    expect(bench.contains(dl)).toBe(false);
    expect(bench.compareDocumentPosition(dl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(dl).position).not.toBe('absolute');
    const facts = [...dl.querySelectorAll(':scope > div')].map((row) => [row.querySelector('dt')!.textContent, row.querySelector('dd')!]);
    expect(facts.map(([k]) => k)).toEqual(['World', 'Lab', 'Created', 'ID']);
    const dd = (k: string) => facts.find(([n]) => n === k)![1] as HTMLElement;
    expect(dd('World').textContent).toBe('Computer Foundations');
    expect(dd('Lab').textContent).toBe('Beta');
    expect(dd('Lab').getAttribute('dir')).toBe('auto');
    expect(dd('Created').textContent).toContain('2026-01-02 03:04 UTC');
    expect(dd('ID').textContent).toBe(ID_B); // the whole identifier, not the short one
    expect(dd('ID').classList.contains('mono')).toBe(true);
    expect(dd('Created').querySelector('.mono')?.textContent).toBe('2026-01-02 03:04 UTC');
  });

  it('has no back link of its own: Worlds is reached through the shell\'s breadcrumb', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_A}`);
    await settle(h);
    expect(toWorlds(h)).toHaveLength(0);
    expect(q(h, 'nav')).toBeNull();
    expect(text(h)).not.toContain('Workspaces');
  });

  it('moves focus to the heading once the lab is ready', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_A}`);
    await settle(h);
    expect(document.activeElement).toBe(heading(h));
  });
});

describe('Lab frame: created times use the date of the lab, not today', () => {
  afterEach(() => vi.unstubAllEnvs());

  async function labCreated(createdAt: string) {
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(valid(ID_A, 'Alpha', createdAt));
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    return h;
  }

  it.each([
    ['winter', '2026-01-15T12:00:00Z', '2026-01-15 07:00', 'GMT-5'],
    ['summer', '2026-07-15T12:00:00Z', '2026-07-15 08:00', 'GMT-4'],
  ])('shows %s time in New York with that date\'s offset, in the bar and in the facts, with UTC beside it', async (_season, createdAt, local, offset) => {
    vi.stubEnv('TZ', 'America/New_York');
    // The offset is only a property of the date if the runtime follows the zone we just set.
    expect(localOffsetLabel(new Date(createdAt))).toBe(offset);
    const h = await labCreated(createdAt);
    expect(q(h, '.labbar .meta')?.textContent).toBe(`Created ${local} (${offset})`);
    const created = [...root(h).querySelectorAll('dl.facts > div')].find((r) => r.querySelector('dt')?.textContent === 'Created')!;
    expect(created.querySelector('time')?.textContent).toBe(`${local} (${offset})`);
    expect(created.querySelector('.mono')?.textContent).toBe(formatCreated(createdAt));
  });

  it('uses the existing formatters and gives the stored UTC time when the local one cannot be made', async () => {
    const h = await labCreated('2026-11-17T07:05:09Z');
    expect(q(h, '.labbar .meta')?.textContent).toContain(formatCreatedLocal('2026-11-17T07:05:09Z'));
  });
});

describe('Lab frame: loading', () => {
  // The region itself belongs to the shell (see app.spec.ts, where its lifecycle is tested). This screen writes its text.
  const message = () => TestBed.inject(StatusMessage).text();

  it('writes "Opening lab…" while it resolves, clears it when the lab is ready, and owns no status region', async () => {
    const gateway = new FakeGateway();
    const pending = deferred<ListResult>();
    gateway.onList = () => pending.promise;
    const h = await mount(gateway, `/workspace/${ID_A}`);
    expect(message()).toBe('Opening lab…');
    expect(q(h, 'main')?.getAttribute('aria-busy')).toBe('true');
    expect(heading(h)).toBeNull();
    pending.resolve(listOf(valid(ID_A, 'Alpha')));
    await settle(h);
    expect(message()).toBe('');
    expect(q(h, 'main')?.getAttribute('aria-busy')).toBe('false');
    expect(heading(h)?.textContent).toBe('Alpha');
    expect(root(h).querySelectorAll('[role=status]')).toHaveLength(0);
  });

  it('says it again on a retry, and clears it for each way a resolution can end', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => failure('storage_unavailable', 'x');
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    expect(message()).toBe(''); // a failed read is not loading

    const pending = deferred<ListResult>();
    gateway.onList = () => pending.promise;
    button(h, 'Try again').click();
    await settle(h);
    expect(message()).toBe('Opening lab…');
    pending.resolve(failure('storage_unavailable', 'x'));
    await settle(h);
    expect(message()).toBe('');

    gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
    button(h, 'Try again').click();
    await settle(h);
    expect(message()).toBe('');
  });

  it('does not ask for the message for a bad address, which never loads', async () => {
    const h = await mount(withTwo(), '/workspace/not-a-uuid');
    await settle(h);
    expect(message()).toBe('');
  });

  it('clears the message if the learner leaves while it is still loading', async () => {
    const gateway = new FakeGateway();
    gateway.onList = () => deferred<ListResult>().promise;
    const h = await mount(gateway, `/workspace/${ID_A}`);
    expect(message()).toBe('Opening lab…');
    await h.navigateByUrl('/worlds');
    await settle(h);
    expect(message()).toBe('');
  });
});

describe('Lab frame: every other state', () => {
  const problem = [
    ['a bad address', 'not-a-uuid', 'Not a lab address', 'This address does not point to a lab.', false],
    ['a lab that is not in the list', ID_C, 'Lab not found', 'This lab is not in your list of labs.', false],
  ] as const;

  it.each(problem)('%s: heading, text and Go to Worlds, no Try again', async (_l, id, headingText, body, retry) => {
    const h = await mount(withTwo(), `/workspace/${id}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe(headingText);
    expect(text(h)).toContain(body);
    expect(toWorlds(h).map((a) => a.textContent?.trim())).toEqual(['Go to Worlds']);
    expect(!!root(h).querySelector('button')).toBe(retry);
    expect(root(h).querySelector('.benchwrap')).toBeNull();
  });

  it('a bad address never asks the host', async () => {
    const gateway = withTwo();
    const h = await mount(gateway, '/workspace/not-a-uuid');
    await settle(h);
    expect(gateway.listCalls).toBe(0);
  });

  it.each([
    ['an uppercase identifier', ID_B.toUpperCase()],
    ['a version 1 identifier', '4f525f09-3c12-149f-872b-c148c25e63ba'],
    ['an identifier with trailing text', `${ID_B}x`],
  ])('rejects %s as a bad address without asking the host', async (_label, id) => {
    const gateway = withTwo();
    const h = await mount(gateway, `/workspace/${encodeURIComponent(id)}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('Not a lab address');
    expect(gateway.listCalls).toBe(0);
  });

  it('an unopenable lab: heading, the reason by kind, the repair limit, Go to Worlds, no Try again, and never the host text', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(invalid(ID_A, 'manifest_missing', 'This workspace folder has no workspace.json file.'));
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('This lab cannot be opened');
    expect(text(h)).toContain('This lab is missing information the application needs to open it.');
    expect(text(h)).toContain('The application cannot repair or remove it.');
    expect(text(h)).not.toContain('workspace.json');
    expect(toWorlds(h)).toHaveLength(1);
    expect(root(h).querySelector('button')).toBeNull();
  });

  it('an unreadable lab: "could not be read", Try again and Go to Worlds, and no repair sentence', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(invalid(ID_A, 'entry_unreadable', 'host text'));
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('This lab could not be read');
    expect(text(h)).not.toContain('repair');
    expect(text(h)).not.toContain('cannot be opened');
    expect(toWorlds(h)).toHaveLength(1);
    gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
    button(h, 'Try again').click();
    await settle(h);
    expect(gateway.listCalls).toBe(2);
    expect(heading(h)?.textContent).toBe('Alpha');
  });

  it('a failed read: "could not be loaded", the list text, that it cannot tell whether the lab exists, an alert, Try again and Go to Worlds', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => failure('storage_unavailable', 'The list of workspaces could not be read.');
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('This lab could not be loaded');
    const alert = q(h, '[role=alert]')!;
    expect(alert.textContent).toContain('The application could not read your labs. Try again.');
    expect(alert.textContent).toContain('Until it can, the application cannot tell whether this lab exists.');
    expect(alert.querySelector('button')?.textContent).toBe('Try again');
    expect(text(h)).not.toContain('workspaces');
    expect(toWorlds(h)).toHaveLength(1);
  });

  it('retries a failed read by listing again, and shows the lab when it works', async () => {
    const gateway = new FakeGateway();
    gateway.onList = async () => failure('storage_unavailable', 'x');
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
    button(h, 'Try again').click();
    await settle(h);
    expect(gateway.listCalls).toBe(2);
    expect(heading(h)?.textContent).toBe('Alpha');
    expect(q(h, '[role=alert]')).toBeNull();
  });

  it('uses no learner-facing word "workspace" in any state', async () => {
    const cases: [string, FakeGateway][] = [
      ['ready', withTwo()],
      ['not found', withTwo()],
      ['unopenable', Object.assign(new FakeGateway(), { onList: async () => listOf(invalid(ID_C, 'manifest_malformed', 'workspace.json')) })],
      ['unreadable', Object.assign(new FakeGateway(), { onList: async () => listOf(invalid(ID_C, 'entry_unreadable', 'workspace.json')) })],
      ['failed', Object.assign(new FakeGateway(), { onList: async () => failure('internal_error', 'workspace') })],
    ];
    for (const [label, gateway] of cases) {
      TestBed.resetTestingModule();
      const h = await mount(gateway, `/workspace/${label === 'ready' ? ID_A : ID_C}`);
      await settle(h);
      expect(text(h).toLowerCase(), label).not.toContain('workspace');
    }
    TestBed.resetTestingModule();
    const bad = await mount(withTwo(), '/workspace/zzz');
    await settle(bad);
    expect(text(bad).toLowerCase()).not.toContain('workspace');
  });
});

describe('Lab frame: focus', () => {
  const focusOn = () => {
    const probe = document.createElement('button');
    document.body.appendChild(probe);
    probe.focus();
    return probe;
  };

  it.each([
    ['a bad address', 'not-a-uuid', () => withTwo()],
    ['a lab not found', ID_C, () => withTwo()],
    ['an unopenable lab', ID_A, () => Object.assign(new FakeGateway(), { onList: async () => listOf(invalid(ID_A, 'manifest_malformed', 'x')) })],
    ['an unreadable lab', ID_A, () => Object.assign(new FakeGateway(), { onList: async () => listOf(invalid(ID_A, 'entry_unreadable', 'x')) })],
    ['a failed read', ID_A, () => Object.assign(new FakeGateway(), { onList: async () => failure('storage_unavailable', 'x') })],
  ])('puts focus on the heading when the route resolves to %s', async (_l, id, gateway) => {
    const h = await mount(gateway(), `/workspace/${id}`);
    await settle(h);
    expect(document.activeElement).toBe(heading(h));
    expect(heading(h)?.getAttribute('tabindex')).toBe('-1');
  });

  it('does not move focus while loading', async () => {
    const gateway = new FakeGateway();
    gateway.onList = () => deferred<ListResult>().promise;
    const probe = focusOn();
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await settle(h);
    expect(document.activeElement).toBe(probe);
    probe.remove();
  });

  it('moves focus once per arrival and does not take it back on later re-renders', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_A}`);
    await settle(h);
    expect(document.activeElement).toBe(heading(h));
    const probe = focusOn();
    await settle(h);
    h.fixture.detectChanges();
    expect(document.activeElement).toBe(probe);
    probe.remove();
  });

  it('after a retry, puts focus on the heading only if the retry left it nowhere, and never takes it from where the learner put it', async () => {
    const failing = new FakeGateway();
    failing.onList = async () => failure('storage_unavailable', 'x');
    const h = await mount(failing, `/workspace/${ID_A}`);
    await settle(h);

    // (a) The Try again button was the focus and went away with the loading state: focus lands on the heading.
    const pendingA = deferred<ListResult>();
    failing.onList = () => pendingA.promise;
    const retry = button(h, 'Try again');
    retry.focus();
    retry.click();
    await settle(h);
    pendingA.resolve(failure('storage_unavailable', 'x'));
    await settle(h);
    expect(document.activeElement).toBe(heading(h));

    // (b) The learner moved focus elsewhere while it was loading: it stays there.
    const pendingB = deferred<ListResult>();
    failing.onList = () => pendingB.promise;
    button(h, 'Try again').click();
    await settle(h);
    const probe = focusOn();
    pendingB.resolve(listOf(valid(ID_A, 'Alpha')));
    await settle(h);
    expect(heading(h)?.textContent).toBe('Alpha');
    expect(document.activeElement).toBe(probe);
    probe.remove();
  });
});

describe('Lab frame: the last-lab pointer', () => {
  it('is written when a retry brings the lab to ready, and not before', async () => {
    const storage = memoryStorage();
    const gateway = new FakeGateway();
    gateway.onList = async () => failure('storage_unavailable', 'x');
    const h = await mount(gateway, `/workspace/${ID_A}`, storage);
    await settle(h);
    expect(storage.data.has(POINTER_KEY)).toBe(false);
    gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
    button(h, 'Try again').click();
    await settle(h);
    expect(storage.data.get(POINTER_KEY)).toBe(ID_A);
  });

  it('is left alone by an unreadable lab, whose retry then fails again', async () => {
    const storage = memoryStorage({ [POINTER_KEY]: ID_B });
    const gateway = new FakeGateway();
    gateway.onList = async () => listOf(invalid(ID_A, 'entry_unreadable', 'x'));
    const h = await mount(gateway, `/workspace/${ID_A}`, storage);
    await settle(h);
    button(h, 'Try again').click();
    await settle(h);
    expect(storage.data.get(POINTER_KEY)).toBe(ID_B);
  });
});

describe('Lab frame: resolving', () => {
  it('is entered by selecting a lab on Worlds, and Worlds is reached again by the Worlds link in the shell', async () => {
    const h = await mount(withTwo(), '/worlds');
    await settle(h);
    root(h).querySelector<HTMLAnchorElement>(`a[href="/workspace/${ID_B}"]`)!.click();
    await settle(h);
    expect(TestBed.inject(Router).url).toBe(`/workspace/${ID_B}`);
    expect(heading(h)?.textContent).toBe('Beta');
    await TestBed.inject(Router).navigateByUrl('/worlds');
    await settle(h);
    expect(heading(h)?.textContent).toBe('Computer Foundations');
    expect(root(h).querySelectorAll('ul.labs a.row')).toHaveLength(2);
  });

  it('restores the same lab from the address after a refresh', async () => {
    const gateway = withTwo();
    const h = await mount(gateway, `/workspace/${ID_B}`);
    await settle(h);
    TestBed.resetTestingModule(); // a refresh discards everything and starts from the address alone
    const reloaded = await mount(gateway, `/workspace/${ID_B}`);
    await settle(reloaded);
    expect(heading(reloaded)?.textContent).toBe('Beta');
    expect(text(reloaded)).toContain(ID_B);
  });

  it('re-resolves when the route changes from one lab to another', async () => {
    const h = await mount(withTwo(), `/workspace/${ID_A}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('Alpha');
    await h.navigateByUrl(`/workspace/${ID_B}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('Beta');
  });

  it('does not show a lab that finished resolving after the route moved on', async () => {
    const gateway = new FakeGateway();
    const slow = deferred<ListResult>();
    let first = true;
    gateway.onList = () => {
      if (first) {
        first = false;
        return slow.promise;
      }
      return Promise.resolve(listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta')));
    };
    const h = await mount(gateway, `/workspace/${ID_A}`);
    await h.navigateByUrl(`/workspace/${ID_B}`);
    await settle(h);
    expect(heading(h)?.textContent).toBe('Beta');
    slow.resolve(listOf(valid(ID_A, 'Alpha'))); // a stale answer that lists only Alpha
    await settle(h);
    expect(heading(h)?.textContent).toBe('Beta');
  });

  it('sends unknown addresses to Worlds', async () => {
    const h = await mount(withTwo(), '/nowhere/at/all');
    await settle(h);
    expect(TestBed.inject(Router).url).toBe('/worlds');
    expect(heading(h)?.textContent).toBe('Computer Foundations');
  });
});
