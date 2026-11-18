export const APP_NAME = 'Engineering Learning Environment';

export type { Result } from './result';
export { parseWorkspaceId, type WorkspaceId } from './id';
export {
  WORKSPACE_NAME_MAX_LENGTH,
  parseStoredWorkspaceName,
  validateWorkspaceName,
  workspaceNameKey,
  type StoredWorkspaceNameError,
  type WorkspaceName,
  type WorkspaceNameError,
} from './name';
export {
  MAX_TIMESTAMP,
  MIN_TIMESTAMP,
  formatTimestamp,
  parseTimestamp,
  type Timestamp,
  type TimestampError,
} from './timestamp';
export {
  WORKSPACE_SCHEMA_VERSION,
  createWorkspace,
  type NewWorkspace,
  type Workspace,
  type WorkspaceError,
} from './workspace';
export { decodeManifest, encodeManifest, type ManifestError } from './manifest';
export {
  PLACE_VALUE_MAX_WIDTH,
  PLACE_VALUE_MIN_WIDTH,
  clearedPattern,
  contributions,
  flipBit,
  flipEffect,
  formatPattern,
  maxTotal,
  parsePattern,
  patternCount,
  resizePattern,
  total,
  weightOf,
  wouldDiscardActiveBits,
  type Bit,
  type BitPattern,
  type FlipEffect,
  type PatternError,
  type PositionError,
  type WidthError,
} from './place-value';
