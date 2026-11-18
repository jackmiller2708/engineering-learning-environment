import { describe, expect, it } from 'vitest';
import * as domain from './index';
import {
  APP_NAME,
  createWorkspace,
  decodeManifest,
  encodeManifest,
  validateWorkspaceName,
  workspaceNameKey,
} from './index';

it('exports the product name', () => {
  expect(APP_NAME).toBe('Engineering Learning Environment');
});

describe('public API', () => {
  it('exposes exactly the intended surface', () => {
    expect(Object.keys(domain).sort()).toEqual(
      [
        'APP_NAME',
        'MAX_TIMESTAMP',
        'PLACE_VALUE_MAX_WIDTH',
        'MIN_TIMESTAMP',
        'PLACE_VALUE_MIN_WIDTH',
        'WORKSPACE_NAME_MAX_LENGTH',
        'WORKSPACE_SCHEMA_VERSION',
        'clearedPattern',
        'contributions',
        'createWorkspace',
        'decodeManifest',
        'encodeManifest',
        'flipBit',
        'flipEffect',
        'formatPattern',
        'formatTimestamp',
        'maxTotal',
        'parsePattern',
        'parseStoredWorkspaceName',
        'parseTimestamp',
        'parseWorkspaceId',
        'patternCount',
        'resizePattern',
        'total',
        'validateWorkspaceName',
        'weightOf',
        'workspaceNameKey',
        'wouldDiscardActiveBits',
      ].sort(),
    );
  });

  it('constructs, encodes and decodes a workspace', () => {
    const created = createWorkspace({
      id: '4f525f09-3c12-449f-872b-c148c25e63ba',
      name: '  Stra\u00DFe  ',
      now: new Date('2026-11-17T07:05:09.482Z'),
    });
    if (!created.ok) throw new Error('create failed');
    const text = encodeManifest(created.value);
    expect(decodeManifest(text)).toEqual({ ok: true, value: created.value });
    expect(created.value.name).toBe('Stra\u00DFe');
  });

  it.each([
    ['Alpha', 'alpha', true],
    ['Stra\u00DFe', 'STRASSE', true],
    ['\u03C3', '\u03C2', true],
    ['caf\u00E9', 'cafe\u0301', false],
  ])('treats %j and %j as duplicate=%s', (a, b, duplicate) => {
    const key = (name: string) => {
      const r = validateWorkspaceName(name);
      if (!r.ok) throw new Error('invalid');
      return workspaceNameKey(r.value);
    };
    expect(key(a) === key(b)).toBe(duplicate);
  });
});
