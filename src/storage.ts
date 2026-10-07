import { createNotebook, formatInput, fromMM } from './domain';
import type { Unit } from './domain';
import type { Notebook } from './domain';
export const STORAGE_KEY = 'five-cuts.notebook.v1';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const unit = (v: unknown) => v === 'mm' || v === 'in';
const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const setup = (v: unknown) => record(v) && ['left', 'right'].includes(String(v.board)) && ['left', 'right'].includes(String(v.pivot)) && ['near', 'far'].includes(String(v.fence));
export function isNotebook(value: unknown): value is Notebook {
  if (!record(value) || value.version !== 1 || !unit(value.unit) || typeof value.activeId !== 'string' || !Array.isArray(value.sessions) || !value.sessions.length) return false;
  const ids = new Set<string>();
  for (const s of value.sessions) {
    if (!record(s) || typeof s.id !== 'string' || ids.has(s.id) || typeof s.name !== 'string' || !date(s.createdAt) || !date(s.updatedAt) || !setup(s.setup) || !record(s.draft) || s.draft.unit !== value.unit || !Array.isArray(s.trials)) return false;
    ids.add(s.id);
    if (!['a', 'b', 'length', 'distance'].every(k => typeof (s.draft as Record<string, unknown>)[k] === 'string')) return false;
    if (s.draft.exactMM !== undefined) {
      if (!record(s.draft.exactMM)) return false;
      for (const [key, exact] of Object.entries(s.draft.exactMM)) {
        if (!['a', 'b', 'length', 'distance'].includes(key) || !record(exact) || typeof exact.value !== 'number' || !Number.isFinite(exact.value) || exact.value < 0 || typeof exact.shown !== 'string') return false;
        if (formatInput(fromMM(exact.value, value.unit as Unit), value.unit as Unit) !== exact.shown) return false;
      }
    }
    if (s.draft.move !== undefined && !(record(s.draft.move) && typeof s.draft.move.amount === 'string' && ['away', 'toward'].includes(String(s.draft.move.direction)))) return false;
    const trialIds = new Set<string>();
    for (const t of s.trials) {
      if (!record(t) || typeof t.id !== 'string' || trialIds.has(t.id) || !date(t.createdAt) || !setup(t.setup) || !record(t.measurements) || !(t.actualMove === null || (typeof t.actualMove === 'number' && Number.isFinite(t.actualMove)))) return false;
      trialIds.add(t.id);
      const m = t.measurements;
      if (!['a', 'b', 'length', 'distance'].every(k => positive(m[k]))) return false;
      if (Math.max(m.a as number, m.b as number) >= (m.length as number) || Math.abs((m.a as number) - (m.b as number)) / (m.length as number) > .1) return false;
    }
  }
  return ids.has(value.activeId);
}
export function loadNotebook(storage: Pick<Storage, 'getItem'>): { notebook: Notebook; error: string; raw: string | null } {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { notebook: createNotebook(), error: '', raw };
    const parsed: unknown = JSON.parse(raw);
    if (!isNotebook(parsed)) throw new Error('Invalid notebook');
    return { notebook: parsed, error: '', raw };
  } catch {
    return { notebook: createNotebook(), error: 'Your saved history could not be read. It has not been overwritten. New work will not be saved until you reset storage.', raw };
  }
}
export function saveNotebook(storage: Pick<Storage, 'setItem'>, notebook: Notebook): string {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(notebook));
    return '';
  } catch {
    return 'This browser could not save your history. Keep this page open and export a backup before leaving.';
  }
}
export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
