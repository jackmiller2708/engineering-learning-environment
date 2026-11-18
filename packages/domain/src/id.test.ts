import { describe, expect, it } from 'vitest';
import { parseWorkspaceId } from './id';

const V4 = '4f525f09-3c12-449f-872b-c148c25e63ba';

describe('parseWorkspaceId', () => {
  it('accepts a canonical lowercase UUID v4', () => {
    expect(parseWorkspaceId(V4)).toEqual({ ok: true, value: V4 });
  });

  it.each(['8', '9', 'a', 'b'])('accepts variant nibble %s', (variant) => {
    const id = `4f525f09-3c12-449f-${variant}72b-c148c25e63ba`;
    expect(parseWorkspaceId(id).ok).toBe(true);
  });

  it.each([
    ['uppercase', V4.toUpperCase()],
    ['version 1', '4f525f09-3c12-149f-872b-c148c25e63ba'],
    ['version 5', '4f525f09-3c12-549f-872b-c148c25e63ba'],
    ['variant c', '4f525f09-3c12-449f-c72b-c148c25e63ba'],
    ['variant 7', '4f525f09-3c12-449f-772b-c148c25e63ba'],
    ['no hyphens', V4.replaceAll('-', '')],
    ['braces', `{${V4}}`],
    ['trailing newline', `${V4}\n`],
    ['leading space', ` ${V4}`],
    ['too short', V4.slice(0, -1)],
    ['non-hex digit', V4.replace('f', 'g')],
    ['empty', ''],
    ['nil UUID', '00000000-0000-0000-0000-000000000000'],
  ])('rejects %s', (_label, id) => {
    expect(parseWorkspaceId(id)).toEqual({ ok: false, error: 'invalid_id' });
  });
});
