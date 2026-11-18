import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKSPACE_SCHEMA_VERSION, createWorkspace } from './workspace';

const ID = '4f525f09-3c12-449f-872b-c148c25e63ba';
const NOW = new Date('2026-11-17T07:05:09.482Z');

afterEach(() => vi.restoreAllMocks());

describe('createWorkspace', () => {
  it('builds a version 1 record from caller-supplied id, name and time', () => {
    expect(createWorkspace({ id: ID, name: 'Alpha', now: NOW })).toEqual({
      ok: true,
      value: { schemaVersion: 1, id: ID, name: 'Alpha', createdAt: '2026-11-17T07:05:09Z' },
    });
    expect(WORKSPACE_SCHEMA_VERSION).toBe(1);
  });

  it('stores the trimmed name with spelling and capitalization intact', () => {
    const r = createWorkspace({ id: ID, name: '  \u00C4lpha MIX \u00A0', now: NOW });
    expect(r.ok && r.value.name).toBe('\u00C4lpha MIX');
  });

  it('does not generate ids, read the clock, or change the supplied Date', () => {
    const now = vi.spyOn(Date, 'now');
    const random = vi.spyOn(Math, 'random');
    const before = NOW.getTime();
    createWorkspace({ id: ID, name: 'Alpha', now: NOW });
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(NOW.getTime()).toBe(before);
  });

  it('is deterministic', () => {
    const a = createWorkspace({ id: ID, name: 'Alpha', now: NOW });
    const b = createWorkspace({ id: ID, name: 'Alpha', now: new Date(NOW) });
    expect(a).toEqual(b);
  });

  it.each([
    ['an uppercase id', { id: ID.toUpperCase(), name: 'Alpha', now: NOW }, { field: 'id', code: 'invalid_id' }],
    ['an empty name', { id: ID, name: ' ', now: NOW }, { field: 'name', code: 'empty' }],
    ['a control character', { id: ID, name: 'A\tB', now: NOW }, { field: 'name', code: 'control_character' }],
    ['a 65-character name', { id: ID, name: 'a'.repeat(65), now: NOW }, { field: 'name', code: 'too_long' }],
    ['an unpaired surrogate', { id: ID, name: '\ud800', now: NOW }, { field: 'name', code: 'malformed_utf16' }],
    ['an invalid Date', { id: ID, name: 'Alpha', now: new Date(Number.NaN) }, { field: 'createdAt', code: 'invalid_timestamp' }],
    ['a date before 1970', { id: ID, name: 'Alpha', now: new Date('1960-01-01T00:00:00Z') }, { field: 'createdAt', code: 'timestamp_out_of_range' }],
  ])('rejects %s', (_label, input, error) => {
    expect(createWorkspace(input)).toEqual({ ok: false, error });
  });

  it('reports the first problem in the order id, name, createdAt', () => {
    expect(createWorkspace({ id: 'x', name: '', now: new Date(Number.NaN) })).toEqual({
      ok: false,
      error: { field: 'id', code: 'invalid_id' },
    });
    expect(createWorkspace({ id: ID, name: '', now: new Date(Number.NaN) })).toEqual({
      ok: false,
      error: { field: 'name', code: 'empty' },
    });
  });
});
