import { err, ok, type Result } from './result';

declare const idBrand: unique symbol;
/** A canonical lowercase UUID version 4. Obtain one only through `parseWorkspaceId`. */
export type WorkspaceId = string & { readonly [idBrand]: true };

// RFC 9562 version 4 (version nibble 4) and variant 10xx (nibble 8, 9, a or b). Lowercase only.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Accepts exactly the canonical form. It never repairs: uppercase or braced input is rejected. */
export function parseWorkspaceId(text: string): Result<WorkspaceId, 'invalid_id'> {
  return UUID_V4.test(text) ? ok(text as WorkspaceId) : err('invalid_id');
}
