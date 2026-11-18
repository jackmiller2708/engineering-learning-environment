import { createWorkspaceGateway, workspaceGateway, type CommandError, type Invoke } from './workspace-gateway';

const WORKSPACE = { id: '4f525f09-3c12-449f-872b-c148c25e63ba', name: 'Alpha', createdAt: '2026-11-17T07:05:09Z' };

/** A stand-in for Tauri's `invoke` that records calls and answers (or rejects) as told. */
function fakeInvoke(outcome: { resolve: unknown } | { reject: unknown }) {
  const calls: { command: string; args: Record<string, unknown> | undefined }[] = [];
  const invoke: Invoke = <T>(command: string, args?: Record<string, unknown>) => {
    calls.push({ command, args });
    return 'resolve' in outcome ? Promise.resolve(outcome.resolve as T) : Promise.reject(outcome.reject);
  };
  return { invoke, calls };
}

describe('workspace gateway', () => {
  describe('listWorkspaces', () => {
    it('invokes list_workspaces with no arguments', async () => {
      const { invoke, calls } = fakeInvoke({ resolve: { entries: [] } });
      await createWorkspaceGateway(invoke).listWorkspaces();
      expect(calls).toEqual([{ command: 'list_workspaces', args: undefined }]);
    });

    it('returns valid and invalid entries as sent, in order', async () => {
      const entries = [
        { status: 'invalid', id: '0a1b2c3d-1111-4222-8333-444455556666', kind: 'manifest_malformed', message: 'workspace.json is not a valid JSON object.' },
        { status: 'valid', ...WORKSPACE },
      ];
      const { invoke } = fakeInvoke({ resolve: { entries } });
      const result = await createWorkspaceGateway(invoke).listWorkspaces();
      expect(result).toEqual({ ok: true, value: { entries } });
      if (result.ok) {
        const first = result.value.entries[0];
        // The union is usable through its declared types.
        expect(first?.status === 'invalid' ? first.kind : undefined).toBe('manifest_malformed');
      }
    });

    it('keeps a structured host error structured', async () => {
      const error: CommandError = { kind: 'storage_unavailable', message: 'The list of workspaces could not be read.' };
      const { invoke } = fakeInvoke({ reject: error });
      expect(await createWorkspaceGateway(invoke).listWorkspaces()).toEqual({ ok: false, error });
    });
  });

  describe('createWorkspace', () => {
    it('invokes create_workspace with only the name, exactly as typed', async () => {
      const { invoke, calls } = fakeInvoke({ resolve: WORKSPACE });
      await createWorkspaceGateway(invoke).createWorkspace('  Alpha  ');
      expect(calls).toEqual([{ command: 'create_workspace', args: { name: '  Alpha  ' } }]);
      expect(Object.keys(calls[0]?.args ?? {})).toEqual(['name']); // no id, path or timestamp can be sent
    });

    it('returns the created workspace', async () => {
      const { invoke } = fakeInvoke({ resolve: WORKSPACE });
      expect(await createWorkspaceGateway(invoke).createWorkspace('Alpha')).toEqual({ ok: true, value: WORKSPACE });
    });

    it('keeps a validation error structured', async () => {
      const error: CommandError = { kind: 'name_empty', message: 'Enter a name for the workspace.' };
      const { invoke } = fakeInvoke({ reject: error });
      expect(await createWorkspaceGateway(invoke).createWorkspace('')).toEqual({ ok: false, error });
    });
  });

  describe('unexpected failures', () => {
    it.each([
      ['an Error (for example, not running inside Tauri)', new TypeError("Cannot read properties of undefined (reading 'invoke')")],
      ['a string', 'boom'],
      ['null', null],
      ['an object without a message', { kind: 'x' }],
      ['an object with non-string fields', { kind: 1, message: 2 }],
      ['undefined', undefined],
      ['a number', 42],
      ['a symbol', Symbol('boom')],
      ['an array', [{ kind: 'name_empty', message: 'x' }]],
      ['a function', () => 'boom'],
      ['an object whose kind is missing', { message: 'only a message' }],
    ])('turns %s into a generic structured error without leaking its text', async (_label, reject) => {
      const { invoke } = fakeInvoke({ reject });
      const result = await createWorkspaceGateway(invoke).createWorkspace('Alpha');
      expect(result).toEqual({ ok: false, error: { kind: 'unexpected_error', message: 'The desktop host returned an unexpected response.' } });
    });
  });

  it('does not throw when invoke itself throws synchronously', async () => {
    const invoke: Invoke = () => {
      throw new Error('no IPC bridge');
    };
    const result = await createWorkspaceGateway(invoke).listWorkspaces();
    expect(result).toEqual({ ok: false, error: { kind: 'unexpected_error', message: 'The desktop host returned an unexpected response.' } });
  });

  it('the default gateway uses the real Tauri invoke and fails safely where there is no IPC bridge', async () => {
    // jsdom has no Tauri runtime, so the real `invoke` rejects. The gateway must not throw.
    expect(await workspaceGateway.listWorkspaces()).toEqual({ ok: false, error: { kind: 'unexpected_error', message: 'The desktop host returned an unexpected response.' } });
  });
});
