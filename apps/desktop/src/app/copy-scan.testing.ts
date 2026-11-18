// Test support only. The learner-visible copy scanner shared by every copy test (Step 6).
// It checks what a learner can read or hear from a rendered page: text, document.title and the text-bearing attributes.

/** A host message that looks like nothing else the scanner bans: no path, no banned word. Only the host-message rule can catch it. */
export const HOST_SENTINEL = 'HOSTSENTINEL-7f3a91 the volume refused the request';
/** A host message that is a path. Only the internal-path rule should catch it, and the host-message rule must not. */
export const HOST_PATH_MESSAGE = 'Cannot read /home/alice/.local/share/dev.engineering-learning-environment.desktop/labs/0a1b';

/** The raw host messages the fixtures feed in. The scanner can only recognise messages it is told about. */
export const KNOWN_HOST_MESSAGES: readonly string[] = [HOST_SENTINEL];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export type Rule = readonly [name: string, pattern: RegExp];

/** The Step 6 owner-approved list (DESIGN_SPEC 2). Ordinary words such as "file" and "path" are not banned. */
export const BANNED: readonly Rule[] = [
  ['workspace', /workspace/i],
  ['manifest', /manifest/i],
  ['workspace.json', /workspace\.json/i],
  ['an internal data-folder path', /(\/home\/|\/\.local\/share|\\\\|[A-Za-z]:\\|dev\.engineering-learning-environment|~\/)/i],
  ['a raw host message', new RegExp(KNOWN_HOST_MESSAGES.map(escape).join('|'))],
];

export const violations = (text: string, rules: readonly Rule[] = BANNED): string[] =>
  rules.filter(([, re]) => re.test(text)).map(([name]) => name);

/** Everything a learner can read or hear from `root`: its text, `document.title` and the text-bearing attributes. */
export function rendered(root: HTMLElement): string {
  const attrs = [...root.querySelectorAll('[title], [aria-label], [placeholder], [alt]')].flatMap((e) =>
    ['title', 'aria-label', 'placeholder', 'alt'].map((a) => e.getAttribute(a) ?? ''),
  );
  return [document.title, root.textContent ?? '', ...attrs].join(' | ').replace(/\s+/g, ' ');
}
