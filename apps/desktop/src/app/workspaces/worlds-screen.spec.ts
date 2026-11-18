import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { WORKSPACE_NAME_MAX_LENGTH } from '@ele/domain';
import { mount, button, q, root, settle, text, type } from '../test-app.testing';
import { FakeGateway, ID_A, ID_B, ID_C, deferred, failure, invalid, listOf, valid, type ListResult } from './fake-gateway.testing';
import { memoryStorage } from './fake-storage.testing';
import { POINTER_KEY } from './last-lab-pointer';
import { DEFINITIVE_KINDS } from './launch-resolver';
import { formatCreated, formatCreatedLocal } from './workspace-format';

const url = () => TestBed.inject(Router).url;
const rows = (h: Parameters<typeof q>[0]) => [...root(h).querySelectorAll<HTMLAnchorElement>('ul.labs a.row')];
const create = (h: Parameters<typeof q>[0]) => button(h, 'Create new lab');

describe('Worlds screen', () => {
  it('announces loading while the list is requested, with the form already usable', async () => {
    const gateway = new FakeGateway();
    const pending = deferred<ListResult>();
    gateway.onList = () => pending.promise;
    const h = await mount(gateway, '/worlds');
    expect(q(h, '.loading[role=status]')?.textContent).toContain('Loading labs');
    expect(q(h, 'main')?.getAttribute('aria-busy')).toBe('true');
    expect(root(h).querySelector('ul.labs')).toBeNull();
    expect(create(h).disabled).toBe(false);
    pending.resolve(listOf());
    await settle(h);
    expect(text(h)).not.toContain('Loading labs');
    expect(q(h, 'main')?.getAttribute('aria-busy')).toBe('false');
  });

  describe('the loading status (DESIGN_SPEC 9: the region exists before its text changes)', () => {
    const region = (h: Parameters<typeof q>[0]) => q(h, 'section[aria-labelledby="labs-heading"] [role=status]');

    it('is one polite status region that stays in the page, and only its text changes, across a retry', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => failure('storage_unavailable', 'x');
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const before = region(h);
      expect(before).not.toBeNull(); // present while there is nothing to announce
      expect(before!.textContent?.trim()).toBe('');

      const pending = deferred<ListResult>();
      gateway.onList = () => pending.promise;
      button(h, 'Try again').click();
      await settle(h);
      expect(region(h)).toBe(before); // the same element, not a new one inserted with its text
      expect(before!.textContent).toContain('Loading labs…');

      pending.resolve(listOf(valid(ID_A, 'Alpha')));
      await settle(h);
      expect(region(h)).toBe(before);
      expect(before!.textContent?.trim()).toBe('');
    });

    it('is the only status region of the Labs area, and takes no space while empty', async () => {
      const h = await mount(new FakeGateway(), '/worlds');
      await settle(h);
      expect(root(h).querySelectorAll('section[aria-labelledby="labs-heading"] [role=status]')).toHaveLength(1);
      expect(region(h)!.hasAttribute('aria-live')).toBe(false); // role=status is already polite
    });
  });

  describe('the World', () => {
    it('is displayed as available: a rail with the current World and a title for it', async () => {
      const h = await mount(new FakeGateway(), '/worlds');
      await settle(h);
      const link = q(h, 'nav[aria-label="Worlds"] a');
      expect(link?.textContent?.trim()).toBe('Computer Foundations');
      expect(link?.getAttribute('aria-current')).toBe('page');
      expect(q(h, 'h1')?.textContent).toBe('Computer Foundations');
    });

    it('has no description line: the title is followed directly by the screen\'s content', async () => {
      const h = await mount(new FakeGateway(), '/worlds');
      await settle(h);
      const text = (q(h, 'main')!.textContent ?? '').replace(/\s+/g, ' ');
      expect(text).not.toMatch(/binary|logic gates|adders/i); // it described content that does not exist yet
      expect(q(h, 'h1')!.nextElementSibling?.tagName).not.toBe('P');
    });

    it('opens no lab and creates none on arrival, on selecting the World, or when the list is empty', async () => {
      const gateway = new FakeGateway();
      const h = await mount(gateway, '/worlds');
      await settle(h);
      expect(text(h)).toContain('You have no labs in this world yet.');
      q<HTMLAnchorElement>(h, 'nav[aria-label="Worlds"] a')!.click();
      await settle(h);
      expect(gateway.createCalls).toEqual([]);
      expect(url()).toBe('/worlds');
    });

    it('takes focus on its heading on arrival', async () => {
      const h = await mount(new FakeGateway(), '/worlds');
      await settle(h);
      expect(document.activeElement).toBe(q(h, 'h1'));
    });

    it('speaks of labs and worlds, never of workspaces', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'), invalid(ID_B, 'manifest_malformed', 'workspace.json is not a valid JSON object.'));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      expect(text(h).toLowerCase()).not.toContain('workspace');
      expect(text(h).toLowerCase()).not.toContain('manifest');
    });
  });

  describe('the create form', () => {
    it('shows the name limit from the domain before submitting, tied to the field, with no maxlength', async () => {
      const h = await mount(new FakeGateway(), '/worlds');
      await settle(h);
      const hint = q(h, '#lab-name-hint');
      expect(hint?.textContent).toBe(`Up to ${WORKSPACE_NAME_MAX_LENGTH} characters.`);
      const input = q<HTMLInputElement>(h, 'input')!;
      expect(input.getAttribute('aria-describedby')).toBe('lab-name-hint');
      expect(input.hasAttribute('maxlength')).toBe(false);
      expect(root(h).querySelector('label')?.textContent?.trim()).toBe('Name');
    });

    it('creates a lab, sends the name exactly as typed, clears the field and refreshes the list', async () => {
      const gateway = new FakeGateway();
      const h = await mount(gateway, '/worlds');
      await settle(h);
      gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
      const input = type(h, '  Alpha ');
      create(h).click();
      await settle(h);
      expect(gateway.createCalls).toEqual(['  Alpha ']);
      expect(gateway.listCalls).toBe(2);
      expect(input.value).toBe('');
      expect(q(h, 'form [role=alert]')).toBeNull();
      expect(url()).toBe('/worlds'); // creating never navigates
    });

    it('confirms the creation with a link to open it, and tags the new row "New"', async () => {
      const gateway = new FakeGateway();
      const h = await mount(gateway, '/worlds');
      await settle(h);
      gateway.onList = async () => listOf(valid(ID_A, 'Older', '2026-01-02T03:04:05Z'), valid(ID_B, 'Alpha'));
      type(h, 'Alpha');
      create(h).click();
      await settle(h);
      const status = q(h, 'form [role=status], .create [role=status]')!;
      expect(status.textContent).toContain('Created “Alpha”.');
      expect(status.querySelector('a')?.getAttribute('href')).toBe(`/workspace/${ID_B}`);
      expect(status.querySelector('a')?.textContent).toBe('Open lab');
      const [first, second] = rows(h);
      expect(first!.textContent).toContain('New');
      expect(second!.textContent).not.toContain('New');
    });

    describe('the "New" tag is transient', () => {
      const tagged = (h: Parameters<typeof q>[0]) => rows(h).filter((r) => r.querySelector('.tag')).map((r) => r.getAttribute('href'));
      const makeLab = async (h: Parameters<typeof q>[0], name: string) => {
        type(h, name);
        create(h).click();
        await settle(h);
      };

      it('moves to the latest successfully created lab, and is on one row only', async () => {
        const gateway = new FakeGateway();
        const h = await mount(gateway, '/worlds');
        await settle(h);
        gateway.onCreate = async (n) => ({ ok: true, value: { id: ID_A, name: n, createdAt: '2026-11-17T07:05:09Z' } });
        gateway.onList = async () => listOf(valid(ID_A, 'First', '2026-11-17T07:05:09Z'));
        await makeLab(h, 'First');
        expect(tagged(h)).toEqual([`/workspace/${ID_A}`]);
        gateway.onCreate = async (n) => ({ ok: true, value: { id: ID_B, name: n, createdAt: '2026-11-17T08:00:00Z' } });
        gateway.onList = async () => listOf(valid(ID_A, 'First', '2026-11-17T07:05:09Z'), valid(ID_B, 'Second', '2026-11-17T08:00:00Z'));
        await makeLab(h, 'Second');
        expect(tagged(h)).toEqual([`/workspace/${ID_B}`]);
      });

      it('stays while the learner stays on Worlds: through a failed attempt and a list refresh', async () => {
        const gateway = new FakeGateway();
        const h = await mount(gateway, '/worlds');
        await settle(h);
        gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
        await makeLab(h, 'Alpha');
        expect(tagged(h)).toEqual([`/workspace/${ID_B}`]);
        gateway.onCreate = async () => failure('name_empty', 'x');
        await makeLab(h, ' ');
        expect(tagged(h)).toEqual([`/workspace/${ID_B}`]); // nothing new was created, so the tag has not moved
        gateway.onCreate = async () => failure('internal_error', 'x'); // unconfirmed: the list is re-read, no lab is known to be new
        await makeLab(h, 'Beta');
        expect(gateway.listCalls).toBeGreaterThan(2);
        expect(tagged(h)).toEqual([`/workspace/${ID_B}`]);
      });

      it('clears when the learner leaves Worlds, and is not back on return', async () => {
        const gateway = new FakeGateway();
        const h = await mount(gateway, '/worlds');
        await settle(h);
        gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
        await makeLab(h, 'Alpha');
        expect(tagged(h)).toHaveLength(1);
        await TestBed.inject(Router).navigateByUrl(`/workspace/${ID_B}`);
        await settle(h);
        await TestBed.inject(Router).navigateByUrl('/worlds');
        await settle(h);
        expect(rows(h)).toHaveLength(1);
        expect(tagged(h)).toEqual([]);
      });

      it('is not stored anywhere, so it cannot survive a reload', async () => {
        const storage = memoryStorage();
        const gateway = new FakeGateway();
        const h = await mount(gateway, '/worlds', storage);
        await settle(h);
        gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
        await makeLab(h, 'Alpha');
        expect(tagged(h)).toHaveLength(1);
        expect([...storage.data.keys()]).toEqual([]); // no key of any kind was written
        TestBed.resetTestingModule();
        const again = await mount(gateway, '/worlds', storage); // a fresh screen, as after a reload
        await settle(again);
        expect(rows(again)).toHaveLength(1);
        expect(tagged(again)).toEqual([]);
      });
    });

    it.each([
      ['a validation failure', 'name_empty', 'Enter a name for the lab.'],
      ['a storage failure', 'storage_write_failed', 'The lab could not be saved. No lab was created. Try again.'],
      ['a clock failure', 'clock_before_epoch', 'This computer’s clock is set to a date the application cannot use. Correct the date and time, then try again.'],
    ])('shows %s as learner text next to the field, keeps what was typed and does not refresh', async (_label, kind, expected) => {
      const gateway = new FakeGateway();
      gateway.onCreate = async () => failure(kind, 'The workspace could not be written. The disk is full.');
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const input = type(h, '  my name  ');
      create(h).click();
      await settle(h);
      const alert = q(h, 'form [role=alert]');
      expect(alert?.textContent).toBe(expected);
      expect(text(h)).not.toContain('disk is full'); // the host's own text is never shown
      expect(input.value).toBe('  my name  ');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe(`${alert?.id} lab-name-hint`);
      expect(document.activeElement).toBe(input);
      expect(gateway.listCalls).toBe(1);
    });

    it('puts the domain limit into the too-long message', async () => {
      const gateway = new FakeGateway();
      gateway.onCreate = async () => failure('name_too_long', 'host text');
      const h = await mount(gateway, '/worlds');
      await settle(h);
      type(h, 'x');
      create(h).click();
      await settle(h);
      expect(q(h, 'form [role=alert]')?.textContent).toBe(`The name is longer than ${WORKSPACE_NAME_MAX_LENGTH} characters. Use a shorter name.`);
    });

    it.each(['internal_error', 'unexpected_error', 'a_kind_nobody_knows'])(
      'refreshes the list after an unconfirmed result (%s), so the learner sees what exists',
      async (kind) => {
        const gateway = new FakeGateway();
        gateway.onCreate = async () => failure(kind, 'host text');
        const h = await mount(gateway, '/worlds');
        await settle(h);
        gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
        type(h, 'Alpha');
        create(h).click();
        await settle(h);
        expect(q(h, 'form [role=alert]')?.textContent).toContain('cannot confirm whether the lab was created');
        expect(gateway.listCalls).toBe(2);
        expect(rows(h)).toHaveLength(1);
      },
    );

    it('clears an old creation error as soon as the learner edits the name', async () => {
      const gateway = new FakeGateway();
      gateway.onCreate = async () => failure('name_empty', 'x');
      const h = await mount(gateway, '/worlds');
      await settle(h);
      type(h, ' ');
      create(h).click();
      await settle(h);
      expect(q(h, 'form [role=alert]')).not.toBeNull();
      const input = type(h, 'A');
      await settle(h);
      expect(q(h, 'form [role=alert]')).toBeNull();
      expect(input.hasAttribute('aria-invalid')).toBe(false);
      expect(input.getAttribute('aria-describedby')).toBe('lab-name-hint');
    });

    it('prevents repeated submission while a creation is pending', async () => {
      const gateway = new FakeGateway();
      const pending = deferred<Awaited<ReturnType<FakeGateway['onCreate']>>>();
      gateway.onCreate = () => pending.promise;
      const h = await mount(gateway, '/worlds');
      await settle(h);
      type(h, 'Alpha');
      const submit = create(h);
      submit.click();
      await settle(h);
      expect(submit.disabled).toBe(true);
      expect(submit.textContent).toContain('Creating');
      submit.click();
      q<HTMLFormElement>(h, 'form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(h);
      expect(gateway.createCalls).toHaveLength(1);
      pending.resolve({ ok: true, value: { id: ID_B, name: 'Alpha', createdAt: '2026-11-17T07:05:09Z' } });
      await settle(h);
      expect(create(h).disabled).toBe(false);
      expect(gateway.createCalls).toHaveLength(1);
    });

    it('still reports the creation when the refresh afterwards fails', async () => {
      const gateway = new FakeGateway();
      const h = await mount(gateway, '/worlds');
      await settle(h);
      gateway.onList = async () => failure('storage_unavailable', 'host text');
      type(h, 'Alpha');
      create(h).click();
      await settle(h);
      expect(q(h, '.create [role=status]')?.textContent).toContain('Created “Alpha”.');
      expect(q(h, 'section[aria-labelledby="labs-heading"] [role=alert]')?.textContent).toContain('The application could not read your labs.');
    });
  });

  describe('the labs list', () => {
    const a = valid(ID_A, 'Zeta', '2026-06-01T00:00:00Z');
    const b = valid(ID_B, 'Alpha', '2026-11-17T07:05:09Z');
    const c = valid(ID_C, 'Alpha', '2026-11-17T07:05:09Z');

    it('lists labs newest created first, equal times by id, each row one link to its route, with a count', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(a, c, b);
      const h = await mount(gateway, '/worlds');
      await settle(h);
      expect(rows(h).map((r) => r.getAttribute('href'))).toEqual([`/workspace/${ID_B}`, `/workspace/${ID_C}`, `/workspace/${ID_A}`]);
      expect(q(h, '#labs-heading')?.textContent).toContain('3 labs');
    });

    it('shows duplicate names as separate rows told apart by time and short id', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_B, 'Same', '2026-01-02T03:04:05Z'), valid(ID_C, 'Same', '2026-02-02T03:04:05Z'));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const r = rows(h);
      expect(r).toHaveLength(2);
      expect(r[0]!.textContent).toContain('d0d0d0d0');
      expect(r[1]!.textContent).toContain('4f525f09');
    });

    it('shows Created in local time, with the UTC time in the title and the offset in the header', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(b);
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const time = root(h).querySelector('ul.labs a.row time')!;
      expect(time.textContent?.trim()).toBe(formatCreatedLocal(b.status === 'valid' ? b.createdAt : ''));
      expect(time.getAttribute('title')).toBe(formatCreated('2026-11-17T07:05:09Z'));
      expect(time.getAttribute('datetime')).toBe('2026-11-17T07:05:09Z');
      expect(root(h).querySelector('.head')?.textContent).toMatch(/Created \(GMT[+-]?[\d:]*\)/);
    });

    it('keeps a long name from overflowing: wrapping name element, full name in title, direction automatic', async () => {
      const long = 'W'.repeat(64);
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, long));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const name = root(h).querySelector('ul.labs a.row .nm')!;
      expect(name.getAttribute('title')).toBe(long);
      expect(name.getAttribute('dir')).toBe('auto');
      expect(name.textContent).toContain(long);
    });

    it('shows unopenable entries in their own group after the labs: visible, explained by kind, never links', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_A, 'manifest_unsupported_version', 'workspace.json has version 9.'), valid(ID_B, 'Alpha'));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      expect(rows(h)).toHaveLength(1);
      const group = q(h, 'ul[aria-labelledby="bad-heading"]')!;
      expect(q(h, '#bad-heading')?.textContent).toBe('Cannot be opened');
      expect(group.textContent).toContain('0a1b2c3d');
      expect(group.textContent).toContain('This lab was saved in a form this version of the application cannot open.');
      expect(group.textContent).not.toContain('workspace.json');
      expect(group.querySelector('a, button')).toBeNull();
      expect(text(h)).toContain('The application cannot repair or remove these labs.');
      expect(root(h).querySelector('ul.labs')!.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('offers Try again for an unreadable entry only, and it re-reads the list', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_A, 'entry_unreadable', 'x'), invalid(ID_B, 'manifest_malformed', 'y'));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const items = [...root(h).querySelectorAll('li.bad')];
      expect(items).toHaveLength(2);
      expect(items[0]!.querySelector('button')?.textContent).toBe('Try again');
      expect(items[1]!.querySelector('button')).toBeNull();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      (items[0]!.querySelector('button') as HTMLButtonElement).click();
      await settle(h);
      expect(gateway.listCalls).toBe(2);
      expect(rows(h)).toHaveLength(1);
    });

    it('shows only the group and a zero count when every entry is unopenable', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_A, 'manifest_missing', 'x'));
      const h = await mount(gateway, '/worlds');
      await settle(h);
      expect(rows(h)).toHaveLength(0);
      expect(q(h, '#labs-heading')?.textContent).toContain('0 labs');
      expect(q(h, 'li.bad')).not.toBeNull();
    });
  });

  describe('when the list cannot be read', () => {
    it('shows one panel with learner text, keeps the form, and loads again on Try again', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => failure('storage_unavailable', 'The list of workspaces could not be read.');
      const h = await mount(gateway, '/worlds');
      await settle(h);
      const panel = q(h, 'section[aria-labelledby="labs-heading"] [role=alert]')!;
      expect(panel.textContent).toContain('Your labs could not be loaded.');
      expect(panel.textContent).toContain('The application could not read your labs. Try again.');
      expect(text(h)).not.toContain('workspaces');
      expect(root(h).querySelector('ul.labs')).toBeNull();
      expect(text(h)).not.toContain('You have no labs');
      expect(q(h, 'form')).not.toBeNull();

      gateway.onList = async () => listOf(valid(ID_B, 'Alpha'));
      button(h, 'Try again').click();
      await settle(h);
      expect(gateway.listCalls).toBe(2);
      expect(q(h, 'section [role=alert]')).toBeNull();
      expect(rows(h)).toHaveLength(1);
    });

    describe('focus after Try again (Task 3.27)', () => {
      const failing = (gateway: FakeGateway) => (gateway.onList = async () => failure('storage_unavailable', 'x'));
      const focusFromButton = (h: Parameters<typeof q>[0]) => {
        button(h, 'Try again').focus();
        expect(document.activeElement).toBe(button(h, 'Try again'));
      };

      it('moves focus to the Labs heading when a retry succeeds and focus was lost with the button', async () => {
        const gateway = new FakeGateway();
        failing(gateway);
        const h = await mount(gateway, '/worlds');
        await settle(h);
        focusFromButton(h);
        gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
        button(h, 'Try again').click();
        await settle(h);
        expect(rows(h)).toHaveLength(1);
        expect(document.activeElement).toBe(q(h, '#labs-heading'));
      });

      it('after a failed retry, puts focus on the Try again button that is shown again', async () => {
        const gateway = new FakeGateway();
        failing(gateway);
        const h = await mount(gateway, '/worlds');
        await settle(h);
        focusFromButton(h);
        const pending = deferred<ListResult>();
        gateway.onList = () => pending.promise;
        button(h, 'Try again').click();
        await settle(h); // the panel and its button are gone while loading
        expect(document.activeElement).toBe(document.body);
        pending.resolve(failure('storage_unavailable', 'x'));
        await settle(h);
        expect(q(h, 'section [role=alert]')).not.toBeNull();
        expect(document.activeElement).toBe(button(h, 'Try again'));
      });

      it('does not take focus from where the learner put it while the retry was pending', async () => {
        const gateway = new FakeGateway();
        failing(gateway);
        const h = await mount(gateway, '/worlds');
        await settle(h);
        focusFromButton(h);
        const pending = deferred<ListResult>();
        gateway.onList = () => pending.promise;
        button(h, 'Try again').click();
        await settle(h);
        const input = q<HTMLInputElement>(h, '#lab-name')!;
        input.focus();
        pending.resolve(listOf(valid(ID_A, 'Alpha')));
        await settle(h);
        expect(document.activeElement).toBe(input);
      });

      it('lets a superseded retry result neither write nor take focus', async () => {
        const gateway = new FakeGateway();
        failing(gateway);
        const h = await mount(gateway, '/worlds');
        await settle(h);
        focusFromButton(h);
        const slow = deferred<ListResult>();
        gateway.onList = () => slow.promise;
        button(h, 'Try again').click();
        await settle(h);
        gateway.onList = async () => failure('storage_unavailable', 'x');
        type(h, 'Beta');
        create(h).click(); // a newer request that fails
        await settle(h);
        q<HTMLInputElement>(h, '#lab-name')!.focus();
        slow.resolve(listOf(valid(ID_A, 'Stale')));
        await settle(h);
        expect(text(h)).not.toContain('Stale');
        expect(document.activeElement).toBe(q(h, '#lab-name'));
      });

      it('does not take focus after the learner has left the screen', async () => {
        const gateway = new FakeGateway();
        failing(gateway);
        const h = await mount(gateway, '/worlds');
        await settle(h);
        focusFromButton(h);
        const pending = deferred<ListResult>();
        gateway.onList = () => pending.promise;
        button(h, 'Try again').click();
        await settle(h);
        await h.navigateByUrl('/workspace/' + ID_A);
        await settle(h);
        pending.resolve(listOf(valid(ID_A, 'Alpha')));
        await settle(h);
        expect(q(h, '#labs-heading')).toBeNull();
        expect(document.activeElement?.closest('app-worlds-screen')).toBeNull();
      });
    });

    it('ignores a slow earlier list response that arrives after a newer one', async () => {
      const gateway = new FakeGateway();
      const slow = deferred<ListResult>();
      gateway.onList = () => slow.promise;
      const h = await mount(gateway, '/worlds');
      gateway.onList = async () => failure('storage_unavailable', 'x');
      type(h, 'Alpha');
      create(h).click();
      await settle(h);
      expect(q(h, 'section [role=alert]')).not.toBeNull();
      slow.resolve(listOf(valid(ID_A, 'Stale')));
      await settle(h);
      expect(text(h)).not.toContain('Stale');
    });
  });

  describe('after a launch that could not restore the last lab', () => {
    const launch = (gateway: FakeGateway, pointer = ID_C) => mount(gateway, '/', memoryStorage({ [POINTER_KEY]: pointer }));
    const notice = (h: Parameters<typeof q>[0]) => q(h, '.notice');

    it('says the lab is no longer available when it is absent', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      const h = await launch(gateway);
      await settle(h);
      expect(url()).toBe('/worlds');
      expect(notice(h)?.textContent).toContain('Your last lab is no longer available.');
      expect(notice(h)?.textContent).toContain('It is not in your list of labs, so Worlds is open instead.');
    });

    it('names an unopenable lab by short id and gives its reason, never the host text', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_C, 'manifest_malformed', 'workspace.json is not a valid JSON object.'));
      const h = await launch(gateway);
      await settle(h);
      const t = notice(h)?.textContent ?? '';
      expect(t).toContain('Your last lab (d0d0d0d0) cannot be opened.');
      expect(t).toContain('The information saved for this lab cannot be read or is not valid.');
      expect(t).toContain('It is listed below under Cannot be opened');
      expect(t).not.toContain('workspace.json');
    });

    it('says an unreadable lab could not be read, and does not call it unopenable', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_C, 'entry_unreadable', 'x'));
      const h = await launch(gateway);
      await settle(h);
      expect(notice(h)?.textContent).toContain('Your last lab (d0d0d0d0) could not be read.');
      expect(notice(h)?.textContent).not.toContain('cannot be opened.');
    });

    it('shows each notice once: not after navigating away and back', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      const h = await launch(gateway);
      await settle(h);
      expect(notice(h)).not.toBeNull();
      await TestBed.inject(Router).navigateByUrl(`/workspace/${ID_A}`);
      await settle(h);
      await TestBed.inject(Router).navigateByUrl('/worlds');
      await settle(h);
      expect(notice(h)).toBeNull();
    });

    it('shows no notice when there was simply nothing to restore', async () => {
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      const h = await mount(gateway, '/', memoryStorage());
      await settle(h);
      expect(notice(h)).toBeNull();
    });

    it.each([...DEFINITIVE_KINDS])('%s: a confirmed unopenable lab gives the "cannot be opened" notice and clears the pointer', async (kind) => {
      const storage = memoryStorage({ [POINTER_KEY]: ID_C });
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_C, kind, 'host text'));
      const h = await mount(gateway, '/', storage);
      await settle(h);
      expect(notice(h)?.textContent).toContain('Your last lab (d0d0d0d0) cannot be opened.');
      expect(storage.data.has(POINTER_KEY)).toBe(false);
    });

    it.each(['entry_unreadable', 'a_kind_from_a_future_host'])('%s: an unconfirmed lab gives "could not be read" and keeps the pointer', async (kind) => {
      const storage = memoryStorage({ [POINTER_KEY]: ID_C });
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(invalid(ID_C, kind, 'host text'));
      const h = await mount(gateway, '/', storage);
      await settle(h);
      expect(notice(h)?.textContent).toContain('Your last lab (d0d0d0d0) could not be read.');
      expect(storage.data.get(POINTER_KEY)).toBe(ID_C);
    });

    it('a transient inability to check never claims the lab is missing, and never opens or creates one', async () => {
      const storage = memoryStorage({ [POINTER_KEY]: ID_A });
      const gateway = new FakeGateway();
      gateway.onList = async () => failure('internal_error', 'host text');
      const h = await mount(gateway, '/', storage);
      await settle(h);
      expect(text(h)).not.toContain('no longer available');
      expect(text(h)).not.toContain('Your last lab');
      button(h, 'Try again').click();
      await settle(h);
      button(h, 'Try again').click();
      await settle(h);
      expect(gateway.createCalls).toEqual([]);
      expect(url()).toBe('/worlds');
      expect(storage.data.get(POINTER_KEY)).toBe(ID_A);
    });

    it('does not show a notice on a plain visit to Worlds, even with a stale pointer (a reload does not run launch)', async () => {
      const storage = memoryStorage({ [POINTER_KEY]: ID_C });
      const gateway = new FakeGateway();
      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      const h = await mount(gateway, '/worlds', storage);
      await settle(h);
      expect(notice(h)).toBeNull();
      expect(storage.data.get(POINTER_KEY)).toBe(ID_C); // only launch decides about the pointer
    });

    it('N-1: a failed check shows one panel led by "Your labs couldn\'t be checked.", and Try again only re-reads the list', async () => {
      const storage = memoryStorage({ [POINTER_KEY]: ID_A });
      const gateway = new FakeGateway();
      gateway.onList = async () => failure('storage_unavailable', 'host text');
      const h = await mount(gateway, '/', storage);
      await settle(h);
      expect(url()).toBe('/worlds');
      expect(root(h).querySelectorAll('[role=alert]')).toHaveLength(1);
      expect(notice(h)).toBeNull(); // one message, not a notice stacked on a panel
      const panel = q(h, 'section [role=alert]')!;
      expect(panel.textContent).toContain("Your labs couldn't be checked.");
      expect(panel.textContent).toContain('The application could not read your labs. Try again.');
      expect(panel.textContent).not.toContain('just now');
      expect(storage.data.get(POINTER_KEY)).toBe(ID_A);

      gateway.onList = async () => listOf(valid(ID_A, 'Alpha'));
      button(h, 'Try again').click();
      await settle(h);
      expect(url()).toBe('/worlds'); // the remembered lab is not reopened
      expect(rows(h)).toHaveLength(1);
      expect(q(h, 'section [role=alert]')).toBeNull();
      expect(storage.data.get(POINTER_KEY)).toBe(ID_A); // neither cleared nor rewritten
    });
  });
});
