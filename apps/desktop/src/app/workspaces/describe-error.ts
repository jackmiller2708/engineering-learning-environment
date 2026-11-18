// The presentation boundary for host errors (LE-015). A pure function from the host's stable `kind`
// to a sentence in the learner's vocabulary (DESIGN_SPEC section 10). The host's own `message` is
// never an input, because it contains internal terms.

export type ErrorContext =
  | { readonly where: 'create'; readonly nameLimit: number }
  | { readonly where: 'list' }
  | { readonly where: 'entry' };

const CLOCK = 'This computer’s clock is set to a date the application cannot use. Correct the date and time, then try again.';
const NOT_SET_UP = 'The application could not set up a new lab. No lab was created. Try again.';
const NOT_SAVED = 'The lab could not be saved. No lab was created. Try again.';
// The same `internal_error` is raised when a host worker did not finish, so "no lab was created"
// would sometimes be false. Never claim it here (R5).
const UNCONFIRMED =
  'Something went wrong inside the application, and it cannot confirm whether the lab was created. Check the list below before trying again.';
const UNREADABLE_INFO = 'The information saved for this lab cannot be read or is not valid.';
const LIST_FAILED = 'The application could not read your labs. Try again.';
const LIST_INTERNAL = 'Something went wrong inside the application while loading your labs. Try again.';

/** Kinds the host sends when creating a lab, plus the gateway's own `unexpected_error`. */
const CREATE: Readonly<Record<string, (nameLimit: number) => string>> = {
  name_empty: () => 'Enter a name for the lab.',
  name_control_character: () => 'The name contains a character that cannot be used. Remove it and try again.',
  name_too_long: (limit) => `The name is longer than ${limit} characters. Use a shorter name.`,
  id_collision: () => NOT_SET_UP,
  id_unavailable: () => NOT_SET_UP,
  clock_before_epoch: () => CLOCK,
  clock_out_of_range: () => CLOCK,
  storage_unavailable: () => NOT_SAVED,
  storage_write_failed: () => NOT_SAVED,
  storage_publish_failed: () => NOT_SAVED,
  storage_unsupported: () => 'This computer cannot save labs safely, so no lab was created.',
  internal_error: () => UNCONFIRMED,
  unexpected_error: () => UNCONFIRMED,
};

/** Kinds that can reach the list: the host's `storage_unavailable` and `internal_error`, and the gateway's. */
const LIST: Readonly<Record<string, string>> = {
  storage_unavailable: LIST_FAILED,
  internal_error: LIST_INTERNAL,
  unexpected_error: LIST_INTERNAL,
};

/** Why one entry in the list is not a usable lab. Several kinds share a sentence on purpose (R3). */
const ENTRY: Readonly<Record<string, string>> = {
  entry_symlink: 'The application does not open this lab because of how it is stored on this computer.', // vague on purpose (R2)
  manifest_missing: 'This lab is missing information the application needs to open it.',
  manifest_not_a_file: UNREADABLE_INFO,
  manifest_too_large: UNREADABLE_INFO,
  manifest_not_utf8: UNREADABLE_INFO,
  manifest_malformed: UNREADABLE_INFO,
  manifest_invalid_field: UNREADABLE_INFO,
  manifest_id_mismatch: UNREADABLE_INFO,
  // The host raises this for "no usable version" and for "a different version", so never newer or older (R1).
  manifest_unsupported_version: 'This lab was saved in a form this version of the application cannot open.',
  // An I/O failure on one entry. The host does not say whether it is permanent, so no "just now" (R1).
  entry_unreadable: 'This lab could not be read.',
};

/** The kinds each table answers for. A test compares these with the kinds the host sends. */
export const KNOWN_KINDS = {
  create: Object.keys(CREATE),
  list: Object.keys(LIST),
  entry: Object.keys(ENTRY),
} as const;

/** The sentence for a failed operation. An unrecognised kind gets the safest sentence for its context. */
export function describeError(kind: string, ctx: ErrorContext): string {
  switch (ctx.where) {
    case 'create':
      return (CREATE[kind] ?? CREATE['unexpected_error']!)(ctx.nameLimit);
    case 'list':
      return LIST[kind] ?? LIST_INTERNAL;
    case 'entry':
      return ENTRY[kind] ?? 'This lab cannot be opened.';
  }
}

/**
 * True when a failed create does not tell us whether the lab was made (`internal_error`, `unexpected_error`
 * and any kind this build does not know). The screen then re-reads the list so the learner sees what exists (R5).
 */
export function isUnconfirmedCreate(kind: string): boolean {
  return !KNOWN_KINDS.create.includes(kind) || kind === 'internal_error' || kind === 'unexpected_error';
}

/** What happened to the remembered lab at launch, before Worlds is shown. */
export type LaunchOutcome =
  | { readonly kind: 'absent' }
  | { readonly kind: 'invalid'; readonly shortId: string; readonly entryKind: string }
  | { readonly kind: 'list-failed' };

/**
 * The notice on Worlds after a launch that could not restore a lab. An invalid entry carries no name,
 * so the lab is named by its short id. A failed listing has no body: the sentence that follows its title
 * is the list-failure panel's own (`describeError(kind, { where: 'list' })`).
 */
export function describeLaunchOutcome(o: LaunchOutcome): { title: string; body?: string } {
  switch (o.kind) {
    case 'absent':
      return { title: 'Your last lab is no longer available.', body: 'It is not in your list of labs, so Worlds is open instead.' };
    case 'list-failed':
      return { title: "Your labs couldn't be checked." }; // N-1: owner wording. No cause, no timing, no restart.
    case 'invalid':
      // Known kinds other than entry_unreadable are confirmed unopenable. entry_unreadable and any kind
      // this build does not know are not confirmed, so they are only "could not be read" (as the pointer rule keeps them).
      return o.entryKind in ENTRY && o.entryKind !== 'entry_unreadable'
        ? {
            title: `Your last lab (${o.shortId}) cannot be opened.`,
            body: `${ENTRY[o.entryKind]} It is listed below under Cannot be opened, and Worlds is open instead.`,
          }
        : { title: `Your last lab (${o.shortId}) could not be read.`, body: 'Worlds is open instead.' };
  }
}

export type LabState =
  | { readonly kind: 'bad-address' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unopenable'; readonly entryKind: string }
  | { readonly kind: 'failed'; readonly listKind: string };

/**
 * Heading, text and whether a Try again belongs, for the lab screen's problem states. `retry` is true
 * where the host has not established the lab is broken (a failed listing, or an unreadable entry).
 * An `entry_unreadable` entry is routed here to the "could not be read" text, so a caller cannot show
 * it the repair sentence by mistake (R6b).
 */
export function describeLabState(s: LabState): { heading: string; body: string; retry: boolean } {
  switch (s.kind) {
    case 'bad-address':
      return { heading: 'Not a lab address', body: 'This address does not point to a lab.', retry: false };
    case 'not-found':
      return { heading: 'Lab not found', body: 'This lab is not in your list of labs.', retry: false };
    case 'unopenable':
      return s.entryKind === 'entry_unreadable'
        ? { heading: 'This lab could not be read', body: '', retry: true }
        : {
            heading: 'This lab cannot be opened',
            body: `${describeError(s.entryKind, { where: 'entry' })} The application cannot repair or remove it.`,
            retry: false,
          };
    case 'failed':
      return {
        heading: 'This lab could not be loaded',
        body: `${describeError(s.listKind, { where: 'list' })} Until it can, the application cannot tell whether this lab exists.`,
        retry: true,
      };
  }
}
