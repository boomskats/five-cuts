import { describe, expect, it } from 'vitest';
import { createNotebook } from './domain';
import { isNotebook, loadNotebook, saveNotebook, STORAGE_KEY } from './storage';

describe('notebook persistence', () => {
  it('roundtrips a session, draft and recorded actual adjustment', () => {
    const n = createNotebook();
    n.sessions[0].draft.a = '8.2';
    n.sessions[0].trials.push({ id: 'trial', createdAt: new Date().toISOString(), setup: n.sessions[0].setup, measurements: { a: 8.2, b: 8, length: 300, distance: 500 }, actualMove: -.1 });
    const data = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => data.set(key, value), getItem: (key: string) => data.get(key) ?? null };
    expect(saveNotebook(storage, n)).toBe('');
    expect(data.has(STORAGE_KEY)).toBe(true);
    expect(loadNotebook(storage).notebook).toEqual(n);
  });
  it('handles unavailable storage and preserves recovery bytes', () => {
    const broken = '{invalid';
    const loaded = loadNotebook({ getItem: () => broken });
    expect(loaded.error).not.toBe(''); expect(loaded.raw).toBe(broken);
    expect(loadNotebook({ getItem: () => { throw new Error('SecurityError'); } }).error).not.toBe('');
    expect(saveNotebook({ setItem: () => { throw new Error('QuotaExceededError'); } }, createNotebook())).toContain('could not save');
  });
  it('creates a fresh notebook only for absent data', () => {
    const loaded = loadNotebook({ getItem: () => null });
    expect(loaded.error).toBe(''); expect(isNotebook(loaded.notebook)).toBe(true);
  });
  it.each([null, [], {}, { version: 999 }, { version: 1, sessions: [] }])('rejects malformed structure %j', value => expect(isNotebook(value)).toBe(false));
  it('rejects impossible active IDs and malformed trials', () => {
    const n = createNotebook();
    expect(isNotebook({ ...n, activeId: 'missing' })).toBe(false);
    expect(isNotebook({ ...n, sessions: [...n.sessions, ...n.sessions] })).toBe(false);
    expect(isNotebook({ ...n, sessions: [{ ...n.sessions[0], trials: [{ id: 'bogus' }] }] })).toBe(false);
  });  it('accepts a drafted actual move and rejects malformed ones', () => {
    const n = createNotebook();
    const withMove = (move: unknown) => ({ ...n, sessions: [{ ...n.sessions[0], draft: { ...n.sessions[0].draft, move } }] });
    expect(isNotebook(withMove({ amount: '0.05', direction: 'toward' }))).toBe(true);
    expect(isNotebook(withMove({ amount: '', direction: 'away' }))).toBe(true);
    expect(isNotebook(withMove({ amount: 0.05, direction: 'away' }))).toBe(false);
    expect(isNotebook(withMove({ amount: '0.05', direction: 'sideways' }))).toBe(false);
    expect(isNotebook(withMove('0.05'))).toBe(false);
  });
});
