import { caseFold } from 'unicode-case-folding';
import { err, ok, type Result } from './result';

declare const nameBrand: unique symbol;
/** A validated, trimmed workspace name. Obtain one only through the functions in this module. */
export type WorkspaceName = string & { readonly [nameBrand]: true };

export type WorkspaceNameError = 'empty' | 'control_character' | 'too_long' | 'malformed_utf16';
export type StoredWorkspaceNameError = WorkspaceNameError | 'not_trimmed';

/** Maximum length in Unicode scalar values (not UTF-16 code units, not bytes). */
export const WORKSPACE_NAME_MAX_LENGTH = 64;

/**
 * Unicode White_Space (PropList.txt). Listed explicitly so that behaviour does not depend on
 * `String.prototype.trim` (which also strips U+FEFF) or on any runtime's Unicode data.
 * Stable since Unicode 6.3. The Rust implementation must use the same set (`char::is_whitespace`).
 */
function isWhiteSpace(cp: number): boolean {
  return (
    (cp >= 0x09 && cp <= 0x0d) ||
    cp === 0x20 ||
    cp === 0x85 ||
    cp === 0xa0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x2028 ||
    cp === 0x2029 ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000
  );
}

/** General_Category Cc: U+0000..U+001F and U+007F..U+009F. */
function isControl(cp: number): boolean {
  return cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f);
}

/** Splits a well-formed UTF-16 string into scalar values; returns undefined if it has an unpaired surrogate. */
function toScalars(text: string): number[] | undefined {
  const scalars: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1); // NaN at the end of the string
      if (!(next >= 0xdc00 && next <= 0xdfff)) return undefined;
      scalars.push((unit - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000);
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return undefined;
    } else {
      scalars.push(unit);
    }
  }
  return scalars;
}

/**
 * Validates user input. Check order: malformed UTF-16, trim, empty, control character, too long.
 * Returns the trimmed name with its spelling and capitalization unchanged. No normalization.
 */
export function validateWorkspaceName(input: string): Result<WorkspaceName, WorkspaceNameError> {
  const scalars = toScalars(input);
  if (scalars === undefined) return err('malformed_utf16');

  let start = 0;
  let end = scalars.length;
  while (start < end && isWhiteSpace(scalars[start] as number)) start++;
  while (end > start && isWhiteSpace(scalars[end - 1] as number)) end--;
  const kept = scalars.slice(start, end);

  if (kept.length === 0) return err('empty');
  if (kept.some(isControl)) return err('control_character');
  if (kept.length > WORKSPACE_NAME_MAX_LENGTH) return err('too_long');
  return ok(String.fromCodePoint(...kept) as WorkspaceName);
}

/** For a name read back from storage: it must already be valid and already trimmed. Never repairs. */
export function parseStoredWorkspaceName(stored: string): Result<WorkspaceName, StoredWorkspaceNameError> {
  const result = validateWorkspaceName(stored);
  if (!result.ok) return result;
  return result.value === stored ? result : err('not_trimmed');
}

/**
 * Comparison key for duplicate detection: Unicode Default Case Folding (CaseFolding.txt statuses
 * C and F, non-Turkic) of the stored name. Two names are duplicates when their keys are equal.
 * No normalization, no locale. The stored display name is never changed.
 * Data version: Unicode 18.0.0 (see README.md for the dependency and how it is verified).
 */
export function workspaceNameKey(name: WorkspaceName): string {
  return caseFold(name);
}
