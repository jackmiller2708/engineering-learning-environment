import { KNOWN_KINDS, describeError, isUnconfirmedCreate, describeLabState, describeLaunchOutcome, type ErrorContext, type LabState, type LaunchOutcome } from './describe-error';
import { DEFINITIVE_KINDS } from './launch-resolver';

/**
 * Every `kind` the Rust host can send, copied from `src-tauri/src/workspace_commands.rs`
 * (`error("...")` in create_error, list_error and worker_failed, and the tuples in entry_problem).
 * A spec cannot read that file (specs are bundled for the browser), so this list is kept by hand.
 * It was compared with the Rust source when written (Task 3.12). A new host kind is NOT detected
 * automatically: see STEP2_REPORT.md.
 */
const HOST_CREATE_KINDS = [
  'name_empty', 'name_control_character', 'name_too_long', 'internal_error', 'id_collision', 'id_unavailable',
  'clock_before_epoch', 'clock_out_of_range', 'storage_unavailable', 'storage_write_failed', 'storage_unsupported',
  'storage_publish_failed',
] as const;
const HOST_ENTRY_KINDS = [
  'entry_symlink', 'entry_unreadable', 'manifest_id_mismatch', 'manifest_invalid_field', 'manifest_malformed',
  'manifest_missing', 'manifest_not_a_file', 'manifest_not_utf8', 'manifest_too_large', 'manifest_unsupported_version',
] as const;
const HOST_LIST_KINDS = ['storage_unavailable', 'internal_error'] as const; // list_error and worker_failed
const FRONTEND_KINDS = ['unexpected_error'] as const; // added by the gateway, not the host

const create = (kind: string, nameLimit = 64) => describeError(kind, { where: 'create', nameLimit });
const list = (kind: string) => describeError(kind, { where: 'list' });
const entry = (kind: string) => describeError(kind, { where: 'entry' });

const BANNED = /\b(path|data folder|file|record|json|link|shortcut|staging|publish|schema|manifest|workspace|identifier|restart|just now|newer|older|temporar)/i;
const NO_LAB_WAS_CREATED = /no lab was created/i;
const UNCONFIRMED =
  'Something went wrong inside the application, and it cannot confirm whether the lab was created. Check the list below before trying again.';

describe('describeError: create', () => {
  it.each([
    ['name_empty', 'Enter a name for the lab.'],
    ['name_control_character', 'The name contains a character that cannot be used. Remove it and try again.'],
    ['id_collision', 'The application could not set up a new lab. No lab was created. Try again.'],
    ['id_unavailable', 'The application could not set up a new lab. No lab was created. Try again.'],
    ['clock_before_epoch', 'This computer’s clock is set to a date the application cannot use. Correct the date and time, then try again.'],
    ['clock_out_of_range', 'This computer’s clock is set to a date the application cannot use. Correct the date and time, then try again.'],
    ['storage_unavailable', 'The lab could not be saved. No lab was created. Try again.'],
    ['storage_write_failed', 'The lab could not be saved. No lab was created. Try again.'],
    ['storage_publish_failed', 'The lab could not be saved. No lab was created. Try again.'],
    ['storage_unsupported', 'This computer cannot save labs safely, so no lab was created.'],
    ['internal_error', UNCONFIRMED],
    ['unexpected_error', UNCONFIRMED],
    ['a_kind_from_a_future_host', UNCONFIRMED],
  ])('%s', (kind, expected) => {
    expect(create(kind)).toBe(expected);
  });

  it('puts the domain limit it is given into name_too_long', () => {
    expect(create('name_too_long', 64)).toBe('The name is longer than 64 characters. Use a shorter name.');
    expect(create('name_too_long', 12)).toBe('The name is longer than 12 characters. Use a shorter name.');
  });

  it('R5: says it cannot confirm, and never claims no lab was created, when the outcome is unknown', () => {
    for (const kind of ['internal_error', 'unexpected_error', 'a_kind_from_a_future_host']) {
      expect(create(kind)).toContain('cannot confirm');
      expect(create(kind)).not.toMatch(NO_LAB_WAS_CREATED);
    }
  });

  it('claims no lab was created only for kinds whose host text says nothing was created or published', () => {
    const may = new Set(['id_collision', 'id_unavailable', 'storage_unavailable', 'storage_write_failed', 'storage_publish_failed', 'storage_unsupported']);
    for (const kind of [...HOST_CREATE_KINDS, ...FRONTEND_KINDS, 'a_kind_from_a_future_host'])
      expect(NO_LAB_WAS_CREATED.test(create(kind)), kind).toBe(may.has(kind));
  });

  it('does not claim that for the clock kinds, which the host does not say', () => {
    expect(create('clock_before_epoch')).not.toMatch(NO_LAB_WAS_CREATED);
    expect(create('clock_out_of_range')).not.toMatch(NO_LAB_WAS_CREATED);
  });
});

describe('describeError: list', () => {
  it('storage_unavailable', () => {
    expect(list('storage_unavailable')).toBe('The application could not read your labs. Try again.');
  });
  it.each(['internal_error', 'unexpected_error', 'a_kind_from_a_future_host'])('%s', (kind) => {
    expect(list(kind)).toBe('Something went wrong inside the application while loading your labs. Try again.');
  });
  it('R4: offers Try again and never a restart', () => {
    for (const kind of [...HOST_LIST_KINDS, ...FRONTEND_KINDS, 'x']) {
      expect(list(kind)).toMatch(/Try again\.$/);
      expect(list(kind)).not.toMatch(/restart/i);
    }
  });
});

describe('describeError: unopenable entry', () => {
  const SIX = 'The information saved for this lab cannot be read or is not valid.';
  it.each([
    ['entry_symlink', 'The application does not open this lab because of how it is stored on this computer.'],
    ['manifest_missing', 'This lab is missing information the application needs to open it.'],
    ['manifest_not_a_file', SIX],
    ['manifest_too_large', SIX],
    ['manifest_not_utf8', SIX],
    ['manifest_malformed', SIX],
    ['manifest_invalid_field', SIX],
    ['manifest_id_mismatch', SIX],
    ['manifest_unsupported_version', 'This lab was saved in a form this version of the application cannot open.'],
    ['entry_unreadable', 'This lab could not be read.'],
    ['a_kind_from_a_future_host', 'This lab cannot be opened.'],
  ])('%s', (kind, expected) => {
    expect(entry(kind)).toBe(expected);
  });

  it('R3: the six information kinds share one sentence, manifest_not_utf8 included', () => {
    const six = ['manifest_not_a_file', 'manifest_too_large', 'manifest_not_utf8', 'manifest_malformed', 'manifest_invalid_field', 'manifest_id_mismatch'];
    expect(new Set(six.map(entry)).size).toBe(1);
  });

  it('R1: entry_unreadable does not say "just now" and does not say the lab is broken', () => {
    expect(entry('entry_unreadable')).not.toMatch(/just now|cannot be opened|not valid/i);
  });

  it('R1: manifest_unsupported_version never says newer or older', () => {
    expect(entry('manifest_unsupported_version')).not.toMatch(/newer|older|later|earlier/i);
  });

  it('R2: entry_symlink stays deliberately vague', () => {
    expect(entry('entry_symlink')).not.toMatch(/link|shortcut|symbolic/i);
  });
});

describe('what the host sends is covered', () => {
  const known = (c: keyof typeof KNOWN_KINDS) => new Set<string>(KNOWN_KINDS[c]);

  it('every create kind has its own entry', () => {
    for (const kind of HOST_CREATE_KINDS) expect(known('create').has(kind), kind).toBe(true);
  });
  it('every list kind has its own entry', () => {
    for (const kind of HOST_LIST_KINDS) expect(known('list').has(kind), kind).toBe(true);
  });
  it('every unopenable-entry kind has its own entry', () => {
    for (const kind of HOST_ENTRY_KINDS) expect(known('entry').has(kind), kind).toBe(true);
  });
  it('knows no kind the host does not send, except the gateway\'s own', () => {
    const sent = new Set<string>([...HOST_CREATE_KINDS, ...HOST_LIST_KINDS, ...HOST_ENTRY_KINDS, ...FRONTEND_KINDS]);
    for (const c of ['create', 'list', 'entry'] as const) for (const kind of KNOWN_KINDS[c]) expect(sent.has(kind), `${c}:${kind}`).toBe(true);
  });
  it('keeps the entry kinds apart from the create kinds', () => {
    for (const kind of KNOWN_KINDS.entry) expect(/^(entry|manifest)_/.test(kind), kind).toBe(true);
    for (const kind of KNOWN_KINDS.create) expect(/^(entry|manifest)_/.test(kind), kind).toBe(false);
  });
});

describe('launch outcomes (Worlds)', () => {
  const SHORT = '3f2b8c1e';
  const outcome = (o: LaunchOutcome) => describeLaunchOutcome(o);

  it('a lab that is no longer in the list', () => {
    expect(outcome({ kind: 'absent' })).toEqual({
      title: 'Your last lab is no longer available.',
      body: 'It is not in your list of labs, so Worlds is open instead.',
    });
  });

  it('a lab that cannot be opened names it by short id and gives the reason', () => {
    expect(outcome({ kind: 'invalid', shortId: SHORT, entryKind: 'manifest_malformed' })).toEqual({
      title: 'Your last lab (3f2b8c1e) cannot be opened.',
      body: 'The information saved for this lab cannot be read or is not valid. It is listed below under Cannot be opened, and Worlds is open instead.',
    });
  });

  it('R1: entry_unreadable says it could not be read, with no "just now"', () => {
    expect(outcome({ kind: 'invalid', shortId: SHORT, entryKind: 'entry_unreadable' })).toEqual({
      title: 'Your last lab (3f2b8c1e) could not be read.',
      body: 'Worlds is open instead.',
    });
  });

  it('an unrecognised kind is treated like entry_unreadable, because the pointer is kept for it', () => {
    expect(outcome({ kind: 'invalid', shortId: SHORT, entryKind: 'a_kind_from_a_future_host' }).title).toBe('Your last lab (3f2b8c1e) could not be read.');
  });

  it('N-1: a failed listing says exactly "Your labs couldn\'t be checked." and nothing temporary or causal', () => {
    const o = outcome({ kind: 'list-failed' });
    expect(o.title).toBe("Your labs couldn't be checked.");
    expect(o.body).toBeUndefined();
    expect(o.title).not.toMatch(/just now|temporar|later|restart|because/i);
  });

  it('agrees with the launch resolver on which kinds are definitive', () => {
    for (const kind of HOST_ENTRY_KINDS) {
      const cannot = outcome({ kind: 'invalid', shortId: SHORT, entryKind: kind }).title.endsWith('cannot be opened.');
      expect(cannot, kind).toBe(DEFINITIVE_KINDS.has(kind));
    }
  });
});

describe('lab screen states', () => {
  const state = (s: LabState) => describeLabState(s);

  it('R6: a bad address and a missing lab use plain words, not "identifier"', () => {
    expect(state({ kind: 'bad-address' })).toEqual({ heading: 'Not a lab address', body: 'This address does not point to a lab.', retry: false });
    expect(state({ kind: 'not-found' })).toEqual({ heading: 'Lab not found', body: 'This lab is not in your list of labs.', retry: false });
  });

  it('an unopenable lab gives the reason and says the application cannot repair or remove it', () => {
    expect(state({ kind: 'unopenable', entryKind: 'manifest_unsupported_version' })).toEqual({
      heading: 'This lab cannot be opened',
      body: 'This lab was saved in a form this version of the application cannot open. The application cannot repair or remove it.',
      retry: false,
    });
  });

  it('R6b: entry_unreadable says it could not be read, offers Try again, and has no repair or removal sentence', () => {
    const s = state({ kind: 'unopenable', entryKind: 'entry_unreadable' });
    expect(s).toEqual({ heading: 'This lab could not be read', body: '', retry: true });
    expect(JSON.stringify(s)).not.toMatch(/repair|remove|cannot be opened/i);
  });

  it('a failed read says it cannot tell whether the lab exists, with the list sentence and Try again', () => {
    expect(state({ kind: 'failed', listKind: 'storage_unavailable' })).toEqual({
      heading: 'This lab could not be loaded',
      body: 'The application could not read your labs. Try again. Until it can, the application cannot tell whether this lab exists.',
      retry: true,
    });
  });
});

describe('every produced string', () => {
  const all = (): string[] => {
    const out: string[] = [];
    const ctxs: ErrorContext[] = [{ where: 'create', nameLimit: 64 }, { where: 'list' }, { where: 'entry' }];
    const kinds = [...HOST_CREATE_KINDS, ...HOST_LIST_KINDS, ...HOST_ENTRY_KINDS, ...FRONTEND_KINDS, 'a_kind_from_a_future_host', ''];
    for (const c of ctxs) for (const k of kinds) out.push(describeError(k, c));
    const parts = (o: { title?: string; heading?: string; body?: string }) => out.push(...[o.title, o.heading, o.body].filter((x): x is string => !!x));
    parts(describeLaunchOutcome({ kind: 'absent' }));
    parts(describeLaunchOutcome({ kind: 'list-failed' }));
    for (const k of [...HOST_ENTRY_KINDS, 'a_kind_from_a_future_host']) parts(describeLaunchOutcome({ kind: 'invalid', shortId: '3f2b8c1e', entryKind: k }));
    parts(describeLabState({ kind: 'bad-address' }));
    parts(describeLabState({ kind: 'not-found' }));
    for (const k of [...HOST_ENTRY_KINDS, 'a_kind_from_a_future_host']) parts(describeLabState({ kind: 'unopenable', entryKind: k }));
    for (const k of [...HOST_LIST_KINDS, ...FRONTEND_KINDS, 'x']) parts(describeLabState({ kind: 'failed', listKind: k }));
    return out;
  };

  it('contains none of the implementation terms the owner banned, nor a claim of cause or timing', () => {
    const strings = all();
    expect(strings.length).toBeGreaterThan(100);
    for (const s of strings) expect(s, s).not.toMatch(BANNED);
  });

  it('is never empty where a message is required', () => {
    for (const k of [...HOST_CREATE_KINDS, 'x']) expect(create(k)).not.toBe('');
    for (const k of [...HOST_LIST_KINDS, 'x']) expect(list(k)).not.toBe('');
    for (const k of [...HOST_ENTRY_KINDS, 'x']) expect(entry(k)).not.toBe('');
  });
});

describe('isUnconfirmedCreate', () => {
  it('is true exactly for the kinds whose text does not claim that no lab was created, and for unknown kinds', () => {
    expect(['internal_error', 'unexpected_error', 'never_seen_before'].map(isUnconfirmedCreate)).toEqual([true, true, true]);
    const confirmed = KNOWN_KINDS.create.filter((k) => !isUnconfirmedCreate(k));
    expect(confirmed).toContain('name_empty');
    expect(confirmed).toContain('storage_write_failed');
    expect(confirmed).not.toContain('internal_error');
    for (const kind of KNOWN_KINDS.create) {
      const text = describeError(kind, { where: 'create', nameLimit: 64 });
      if (isUnconfirmedCreate(kind)) expect(text, kind).toContain('cannot confirm whether the lab was created');
    }
  });
});
