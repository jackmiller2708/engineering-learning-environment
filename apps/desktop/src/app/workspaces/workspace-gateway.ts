import { InjectionToken } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import type { Result } from '@ele/domain';

// The IPC contract with the Rust host (apps/desktop/src-tauri/src/workspace_commands.rs).
// Transport lives here, not in the pure domain package. The host never sends paths.

/** A workspace as the host reports it. */
export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

/** A folder that is not a usable workspace. `kind` is a stable code; `message` is for people. */
export interface InvalidEntryDto {
  readonly status: 'invalid';
  readonly id: string;
  readonly kind: string;
  readonly message: string;
}

export type WorkspaceEntryDto = ({ readonly status: 'valid' } & WorkspaceDto) | InvalidEntryDto;

export interface ListWorkspacesResponse {
  readonly entries: readonly WorkspaceEntryDto[];
}

/** The error shape of every command. */
export interface CommandError {
  readonly kind: string;
  readonly message: string;
}

/** The part of Tauri's `invoke` this gateway needs. A test passes a fake. */
export type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface WorkspaceGateway {
  listWorkspaces(): Promise<Result<ListWorkspacesResponse, CommandError>>;
  /** Sends the name exactly as typed; the host trims and validates it. */
  createWorkspace(name: string): Promise<Result<WorkspaceDto, CommandError>>;
}

const UNEXPECTED: CommandError = {
  kind: 'unexpected_error',
  message: 'The desktop host returned an unexpected response.',
};

function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['kind'] === 'string' &&
    typeof (value as Record<string, unknown>)['message'] === 'string'
  );
}

export function createWorkspaceGateway(call: Invoke): WorkspaceGateway {
  async function run<T>(command: string, args?: Record<string, unknown>): Promise<Result<T, CommandError>> {
    try {
      return { ok: true, value: await call<T>(command, args) };
    } catch (error) {
      // A rejection is either the host's structured error or something else (for example, no
      // IPC bridge outside Tauri). The latter is not shown: its text is not part of the contract.
      return { ok: false, error: isCommandError(error) ? { kind: error.kind, message: error.message } : UNEXPECTED };
    }
  }

  return {
    listWorkspaces: () => run<ListWorkspacesResponse>('list_workspaces'),
    createWorkspace: (name) => run<WorkspaceDto>('create_workspace', { name }),
  };
}

/** The gateway backed by the real Tauri IPC (`@tauri-apps/api/core`). */
export const workspaceGateway: WorkspaceGateway = createWorkspaceGateway(invoke);

/** Components get the gateway from here, so tests can provide a stand-in. */
export const WORKSPACE_GATEWAY = new InjectionToken<WorkspaceGateway>('WORKSPACE_GATEWAY', {
  providedIn: 'root',
  factory: () => workspaceGateway,
});
