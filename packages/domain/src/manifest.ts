import { parseWorkspaceId } from './id';
import { parseStoredWorkspaceName, type StoredWorkspaceNameError } from './name';
import { err, ok, type Result } from './result';
import { parseTimestamp, type TimestampError } from './timestamp';
import { WORKSPACE_SCHEMA_VERSION, type Workspace } from './workspace';

export type ManifestError =
  | { readonly code: 'malformed_json' | 'not_an_object' | 'invalid_schema_version' }
  | { readonly code: 'unsupported_version'; readonly version: number }
  | { readonly field: 'id'; readonly code: 'missing' | 'not_a_string' | 'invalid_id' }
  | { readonly field: 'name'; readonly code: 'missing' | 'not_a_string' | StoredWorkspaceNameError }
  | { readonly field: 'createdAt'; readonly code: 'missing' | 'not_a_string' | TimestampError };

/**
 * Deterministic JSON: fixed key order, two-space indent, trailing newline.
 * Decoding accepts any JSON layout, so other writers (for example Rust) need not match these bytes.
 */
export function encodeManifest(workspace: Workspace): string {
  return `${JSON.stringify(
    {
      schemaVersion: workspace.schemaVersion,
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
    },
    null,
    2,
  )}\n`;
}

/**
 * Validates the complete contract. Never repairs: a name that is not already trimmed is rejected.
 * Unknown extra properties are ignored (forward compatibility) and are not kept.
 * Check order: JSON, object, schemaVersion, then id, name, createdAt.
 */
export function decodeManifest(text: string): Result<Workspace, ManifestError> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return err({ code: 'malformed_json' });
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return err({ code: 'not_an_object' });
  const o = data as Record<string, unknown>;

  const version = o['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version)) return err({ code: 'invalid_schema_version' });
  if (version !== WORKSPACE_SCHEMA_VERSION) return err({ code: 'unsupported_version', version });

  const rawId = o['id'];
  if (rawId === undefined) return err({ field: 'id', code: 'missing' });
  if (typeof rawId !== 'string') return err({ field: 'id', code: 'not_a_string' });
  const id = parseWorkspaceId(rawId);
  if (!id.ok) return err({ field: 'id', code: id.error });

  const rawName = o['name'];
  if (rawName === undefined) return err({ field: 'name', code: 'missing' });
  if (typeof rawName !== 'string') return err({ field: 'name', code: 'not_a_string' });
  const name = parseStoredWorkspaceName(rawName);
  if (!name.ok) return err({ field: 'name', code: name.error });

  const rawCreatedAt = o['createdAt'];
  if (rawCreatedAt === undefined) return err({ field: 'createdAt', code: 'missing' });
  if (typeof rawCreatedAt !== 'string') return err({ field: 'createdAt', code: 'not_a_string' });
  const createdAt = parseTimestamp(rawCreatedAt);
  if (!createdAt.ok) return err({ field: 'createdAt', code: createdAt.error });

  return ok({ schemaVersion: WORKSPACE_SCHEMA_VERSION, id: id.value, name: name.value, createdAt: createdAt.value });
}
