// Test support only (excluded from the application build). A controllable stand-in for the
// workspace gateway, used at the component boundary instead of mocking Tauri or the router.
import type { Result } from '@ele/domain';
import type {
  CommandError,
  InvalidEntryDto,
  ListWorkspacesResponse,
  WorkspaceDto,
  WorkspaceEntryDto,
  WorkspaceGateway,
} from './workspace-gateway';

export type ListResult = Result<ListWorkspacesResponse, CommandError>;
export type CreateResult = Result<WorkspaceDto, CommandError>;

export const ID_A = '0a1b2c3d-1111-4222-8333-444455556666';
export const ID_B = '4f525f09-3c12-449f-872b-c148c25e63ba';
export const ID_C = 'd0d0d0d0-2222-4333-9444-555566667777';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export const valid = (id: string, name: string, createdAt = '2026-11-17T07:05:09Z'): WorkspaceEntryDto => ({
  status: 'valid',
  id,
  name,
  createdAt,
});

export const invalid = (id: string, kind = 'manifest_malformed', message = 'workspace.json is not a valid JSON object.'): InvalidEntryDto => ({
  status: 'invalid',
  id,
  kind,
  message,
});

export const listOf = (...entries: WorkspaceEntryDto[]): ListResult => ({ ok: true, value: { entries } });
export const failure = (kind: string, message: string): { ok: false; error: CommandError } => ({ ok: false, error: { kind, message } });

export class FakeGateway implements WorkspaceGateway {
  listCalls = 0;
  createCalls: string[] = [];
  onList: () => Promise<ListResult> = async () => listOf();
  onCreate: (name: string) => Promise<CreateResult> = async (name) => ({
    ok: true,
    value: { id: ID_B, name: name.trim(), createdAt: '2026-11-17T07:05:09Z' },
  });

  listWorkspaces(): Promise<ListResult> {
    this.listCalls++;
    return this.onList();
  }

  createWorkspace(name: string): Promise<CreateResult> {
    this.createCalls.push(name);
    return this.onCreate(name);
  }
}
