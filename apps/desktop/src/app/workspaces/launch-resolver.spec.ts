import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { StatusMessage } from '../status-message';
import { mount, q, root, settle, text } from '../test-app.testing';
import { POINTER_KEY } from './last-lab-pointer';
import { memoryStorage, throwingStorage } from './fake-storage.testing';
import { FakeGateway, ID_A, ID_B, ID_C, deferred, failure, invalid, listOf, valid, type ListResult } from './fake-gateway.testing';

const withTwo = () => {
  const g = new FakeGateway();
  g.onList = async () => listOf(valid(ID_A, 'Alpha'), valid(ID_B, 'Beta'));
  return g;
};
const url = () => TestBed.inject(Router).url;

describe('Launch', () => {
  it('opens Worlds when there is no pointer, without asking the host', async () => {
    const g = withTwo();
    const h = await mount(g, '/', memoryStorage());
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(g.listCalls).toBe(1); // the Worlds screen's own list, not a launch check
  });

  it('shows that it is opening the last lab while it waits', async () => {
    const g = new FakeGateway();
    const pending = deferred<ListResult>();
    g.onList = () => pending.promise;
    const h = await mount(g, '/', memoryStorage({ [POINTER_KEY]: ID_A }));
    expect(TestBed.inject(StatusMessage).text()).toBe('Opening your last lab…'); // the region is the shell's (app.spec.ts)
    expect(root(h).querySelectorAll('[role=status]')).toHaveLength(0); // the resolver owns none
    pending.resolve(listOf(valid(ID_A, 'Alpha')));
    await settle(h);
    expect(url()).toBe(`/workspace/${ID_A}`);
  });

  it('restores the same lab when the pointer is valid and the lab opens', async () => {
    const s = memoryStorage({ [POINTER_KEY]: ID_B });
    const h = await mount(withTwo(), '/', s);
    await settle(h);
    expect(url()).toBe(`/workspace/${ID_B}`);
    expect(q(h, 'h1')?.textContent).toBe('Beta');
    expect(s.data.get(POINTER_KEY)).toBe(ID_B);
  });

  it('opens Worlds for an invalid pointer and clears it', async () => {
    const s = memoryStorage({ [POINTER_KEY]: 'garbage' });
    const g = withTwo();
    const h = await mount(g, '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(s.data.has(POINTER_KEY)).toBe(false);
  });

  it('opens Worlds and clears the pointer when the lab is absent from a successful listing', async () => {
    const s = memoryStorage({ [POINTER_KEY]: ID_C });
    const h = await mount(withTwo(), '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(s.data.has(POINTER_KEY)).toBe(false);
  });

  it.each([
    'entry_symlink',
    'manifest_missing',
    'manifest_not_a_file',
    'manifest_too_large',
    'manifest_not_utf8',
    'manifest_malformed',
    'manifest_invalid_field',
    'manifest_id_mismatch',
    'manifest_unsupported_version',
  ])('opens Worlds and clears the pointer for the definitive kind %s', async (kind) => {
    const g = new FakeGateway();
    g.onList = async () => listOf(invalid(ID_A, kind), valid(ID_B, 'Beta'));
    const s = memoryStorage({ [POINTER_KEY]: ID_A });
    const h = await mount(g, '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(s.data.has(POINTER_KEY)).toBe(false);
  });

  it.each(['entry_unreadable', 'a_kind_from_a_future_host'])('opens Worlds and keeps the pointer for %s', async (kind) => {
    const g = new FakeGateway();
    g.onList = async () => listOf(invalid(ID_A, kind));
    const s = memoryStorage({ [POINTER_KEY]: ID_A });
    const h = await mount(g, '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(s.data.get(POINTER_KEY)).toBe(ID_A);
  });

  it('opens Worlds and keeps the pointer when the listing fails, then lets the learner retry there', async () => {
    const g = new FakeGateway();
    g.onList = async () => failure('storage_unavailable', 'The list of workspaces could not be read.');
    const s = memoryStorage({ [POINTER_KEY]: ID_A });
    const h = await mount(g, '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(s.data.get(POINTER_KEY)).toBe(ID_A);
    expect(q(h, '[role=alert]')).not.toBeNull();
  });

  it('opens Worlds when storage cannot be read', async () => {
    const h = await mount(withTwo(), '/', throwingStorage());
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(text(h)).toContain('Computer Foundations');
  });

  it('still opens the lab when the pointer cannot be written afterwards', async () => {
    const g = withTwo();
    const h = await mount(g, `/workspace/${ID_A}`, throwingStorage());
    await settle(h);
    expect(q(h, 'h1')?.textContent).toBe('Alpha');
  });

  it('still shows Worlds when the pointer cannot be cleared', async () => {
    const s = memoryStorage({ [POINTER_KEY]: ID_C });
    s.removeItem = () => {
      throw new Error('read-only');
    };
    const h = await mount(withTwo(), '/', s);
    await settle(h);
    expect(url()).toBe('/worlds');
    expect(q(h, 'h1')?.textContent).toBe('Computer Foundations');
  });
});

describe('The pointer is written only after a lab opened', () => {
  const cases: [string, () => FakeGateway, string][] = [
    ['a bad address', withTwo, 'not-a-uuid'],
    ['a lab that is not found', withTwo, ID_C],
    [
      'an unopenable lab',
      () => {
        const g = new FakeGateway();
        g.onList = async () => listOf(invalid(ID_A));
        return g;
      },
      ID_A,
    ],
    [
      'a failed listing',
      () => {
        const g = new FakeGateway();
        g.onList = async () => failure('storage_unavailable', 'x');
        return g;
      },
      ID_A,
    ],
  ];
  it.each(cases)('writes nothing for %s and leaves an existing pointer alone', async (_l, gateway, id) => {
    const s = memoryStorage({ [POINTER_KEY]: ID_B });
    const h = await mount(gateway(), `/workspace/${encodeURIComponent(id)}`, s);
    await settle(h);
    expect(s.data.get(POINTER_KEY)).toBe(ID_B);
  });

  it('writes nothing while the lab is still loading', async () => {
    const g = new FakeGateway();
    const pending = deferred<ListResult>();
    g.onList = () => pending.promise;
    const s = memoryStorage();
    const h = await mount(g, `/workspace/${ID_A}`, s);
    expect(s.data.size).toBe(0);
    pending.resolve(listOf(valid(ID_A, 'Alpha')));
    await settle(h);
    expect(s.data.get(POINTER_KEY)).toBe(ID_A);
  });

  it('writes the id once the lab is ready, and replaces an older pointer', async () => {
    const s = memoryStorage({ [POINTER_KEY]: ID_A });
    const h = await mount(withTwo(), `/workspace/${ID_B}`, s);
    await settle(h);
    expect(s.data.get(POINTER_KEY)).toBe(ID_B);
  });

  it('writes nothing when a creation succeeds or Worlds is merely shown', async () => {
    const s = memoryStorage();
    const h = await mount(withTwo(), '/worlds', s);
    await settle(h);
    expect(s.data.size).toBe(0);
  });
});

describe('Restoring a lab', () => {
  it('moves focus to the restored lab\'s heading', async () => {
    const h = await mount(withTwo(), '/', memoryStorage({ [POINTER_KEY]: ID_B }));
    await settle(h);
    expect(q(h, 'h1')?.textContent).toBe('Beta');
    expect(document.activeElement).toBe(q(h, 'h1'));
  });

  it.each([
    ['restores a lab', () => memoryStorage({ [POINTER_KEY]: ID_B }), `/workspace/${ID_B}`],
    ['goes to Worlds with no pointer', () => memoryStorage(), '/worlds'],
    ['goes to Worlds when the lab is gone', () => memoryStorage({ [POINTER_KEY]: ID_C }), '/worlds'],
  ])('replaces the launch address in history when it %s, so Back never returns to it', async (_l, storage, target) => {
    const navigate = vi.spyOn(Router.prototype, 'navigate');
    try {
      const h = await mount(withTwo(), '/', storage());
      await settle(h);
      const launch = navigate.mock.calls.filter(([commands]) => commands.join('/').replace(/^\//, '') === target.replace(/^\//, ''));
      expect(launch).toHaveLength(1);
      expect(launch[0]![1]).toMatchObject({ replaceUrl: true });
    } finally {
      navigate.mockRestore();
    }
  });
});
