import { describe, expect, it } from 'vitest';
import { pickSeenBy, SEEN_BY_MAX_AVATARS } from './seen-by.js';

const at = (ms: number) => new Date(1_700_000_000_000 + ms);
const anchor = { id: 'm-050', createdAt: at(50), senderId: 'alice' };
const cursor = (id: string, ms: number) => ({ id, createdAt: at(ms) });

describe('pickSeenBy', () => {
  it('includes readers whose cursor is at or after the anchor', () => {
    const result = pickSeenBy(
      anchor,
      [
        { userId: 'bob', cursor: cursor('m-060', 60), user: 'bob' },
        { userId: 'carol', cursor: cursor('m-050', 50), user: 'carol' },
      ],
      'alice',
    );
    expect(result.count).toBe(2);
    expect(result.users).toEqual(['bob', 'carol']);
  });

  it('excludes readers whose cursor is older than the anchor', () => {
    const result = pickSeenBy(
      anchor,
      [{ userId: 'bob', cursor: cursor('m-040', 40), user: 'bob' }],
      'alice',
    );
    expect(result).toEqual({ users: [], count: 0 });
  });

  it('compares (createdAt, id) when timestamps are equal', () => {
    const sameTime = { id: 'm-b', createdAt: at(50), senderId: 'alice' };
    const result = pickSeenBy(
      sameTime,
      [
        { userId: 'bob', cursor: cursor('m-a', 50), user: 'bob' },
        { userId: 'carol', cursor: cursor('m-c', 50), user: 'carol' },
      ],
      'alice',
    );
    expect(result.users).toEqual(['carol']);
  });

  it('excludes the viewer and the anchor sender', () => {
    const result = pickSeenBy(
      anchor,
      [
        { userId: 'alice', cursor: cursor('m-060', 60), user: 'alice' },
        { userId: 'me', cursor: cursor('m-060', 60), user: 'me' },
        { userId: 'bob', cursor: cursor('m-060', 60), user: 'bob' },
      ],
      'me',
    );
    expect(result.users).toEqual(['bob']);
    expect(result.count).toBe(1);
  });

  it('orders newest cursor first and caps avatars while keeping total count', () => {
    const candidates = Array.from({ length: 7 }, (_, i) => ({
      userId: `u${i}`,
      cursor: cursor(`m-${i}`, 51 + i),
      user: `u${i}`,
    }));
    const result = pickSeenBy(anchor, candidates, 'viewer');
    expect(result.count).toBe(7);
    expect(result.users).toHaveLength(SEEN_BY_MAX_AVATARS);
    expect(result.users[0]).toBe('u6');
    expect(result.users).toEqual(['u6', 'u5', 'u4', 'u3', 'u2']);
  });
});
