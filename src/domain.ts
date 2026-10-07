export type Unit = 'mm' | 'in';
export type Side = 'left' | 'right';
export type Fence = 'near' | 'far';
export interface Setup { board: Side; fence: Fence; pivot: Side }
export interface Measurements { a: number; b: number; length: number; distance: number }
export type Dimension = keyof Measurements;
export type MoveDirection = 'away' | 'toward';
export interface Draft {
  a: string; b: string; length: string; distance: string; unit: Unit;
  // Retain the unrounded value while showing a concise converted number.
  exactMM?: Partial<Record<Dimension, { value: number; shown: string }>>;
  // The move actually made, when it differs from the suggestion. Absent = use the suggestion.
  move?: { amount: string; direction: MoveDirection };
}
export interface Trial {
  id: string;
  createdAt: string;
  measurements: Measurements;
  setup: Setup;
  actualMove: number | null; // millimetres; positive = away from operator
}
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  setup: Setup;
  draft: Draft;
  trials: Trial[];
}
export interface Notebook { version: 1; unit: Unit; activeId: string; sessions: Session[] }
export const DEFAULT_SETUP: Setup = { board: 'left', fence: 'near', pivot: 'left' };
export const toMM = (value: number, unit: Unit) => unit === 'in' ? value * 25.4 : value;
export const fromMM = (value: number, unit: Unit) => unit === 'in' ? value / 25.4 : value;

/** Decimal numbers only, including a locale decimal comma. Never silently parse fractions or suffixes. */
export function parseDecimal(raw: string): number | null {
  const value = raw.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function formatInput(value: number, unit: Unit): string {
  if (!Number.isFinite(value)) return '';
  // Six/seven decimals are ample for an editable workshop measurement. Trim
  // trailing zeroes, but keep a nonzero sub-resolution value rather than erase it.
  const digits = unit === 'mm' ? 6 : 7;
  const rounded = Number(value.toFixed(digits));
  return new Intl.NumberFormat('en-US', rounded === 0 && value !== 0
    ? { useGrouping: false, maximumSignificantDigits: 6 }
    : { useGrouping: false, maximumFractionDigits: digits }).format(rounded === 0 && value !== 0 ? value : rounded);
}
export function draftValueMM(draft: Draft, key: Dimension): number | null {
  const value = parseDecimal(draft[key]);
  if (value === null) return null;
  const exact = draft.exactMM?.[key];
  return exact?.shown === draft[key] ? exact.value : toMM(value, draft.unit);
}
export function setDraftField(draft: Draft, key: Dimension, value: string): Draft {
  const exactMM = { ...draft.exactMM };
  delete exactMM[key];
  return { ...draft, [key]: value, exactMM };
}
export function convertDraft(draft: Draft, unit: Unit): Draft {
  const next: Draft = { ...draft, unit, exactMM: {} };
  for (const key of ['a', 'b', 'length', 'distance'] as const) {
    const mm = draftValueMM(draft, key);
    if (mm === null || !Number.isFinite(mm)) continue;
    next[key] = formatInput(fromMM(mm, unit), unit);
    next.exactMM![key] = { value: mm, shown: next[key] };
  }
  const move = draft.move && parseDecimal(draft.move.amount);
  if (draft.move && move !== null && move !== undefined) next.move = { ...draft.move, amount: formatInput(fromMM(toMM(move, draft.unit), unit), unit) };
  return next;
}
export function readMeasurements(draft: Draft): Measurements | null {
  const values = (['a', 'b', 'length', 'distance'] as const).map(key => draftValueMM(draft, key));
  if (values.some(value => value === null || value <= 0)) return null;
  const [a, b, length, distance] = values as number[];
  if (![a, b, length, distance].every(Number.isFinite)) return null;
  if (Math.max(a, b) >= length || Math.abs(a - b) / length > 0.1) return null;
  return { a, b, length, distance };
}

/**
 * Top view: x right, y away from the operator. A is the leading (far) strip end.
 * Every freshly cut edge is placed against the fence, with the same face up.
 * Four turns accumulate four times the fence angle. A right-hand offcut has
 * (A-B)/L = -tan(4*alpha); a left-hand offcut has +tan(4*alpha).
 * A pivot at the left means the adjustment point is to its right, and vice versa.
 * D is measured along the fence, pivot to adjustment point. The travel-axis
 * displacement to square is D*sin(correction), signed by the pivot side.
 */
export function calculate(m: Measurements, setup: Setup) {
  const bladeSign = setup.board === 'left' ? 1 : -1;
  const pivotSign = setup.pivot === 'left' ? 1 : -1;
  const taper = m.a - m.b;
  const correctionRadians = bladeSign * Math.atan(taper / m.length) / 4;
  const move = pivotSign * m.distance * Math.sin(correctionRadians);
  return {
    taper,
    correctionRadians,
    errorDegrees: -correctionRadians * 180 / Math.PI,
    errorPerMetre: Math.tan(-correctionRadians) * 1000,
    move,
    direction: Math.abs(move) < 1e-10 ? 'none' as const : move > 0 ? 'away' as const : 'toward' as const,
  };
}
export function rotation(setup: Setup): 'clockwise' | 'anticlockwise' {
  return (setup.board === 'left') === (setup.fence === 'near') ? 'clockwise' : 'anticlockwise';
}
export function format(valueMM: number, unit: Unit, signed = false) {
  const value = fromMM(valueMM, unit);
  const digits = unit === 'mm' ? 3 : 4;
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0 && value !== 0) return `${value < 0 ? '−' : signed ? '+' : ''}<${unit === 'mm' ? '0.001' : '0.0001'}`;
  return `${rounded > 0 && signed ? '+' : ''}${Object.is(rounded, -0) ? 0 : rounded.toFixed(digits)}`;
}
export function createSession(unit: Unit, setup = DEFAULT_SETUP, index = 1): Session {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), name: `Sled ${index}`, createdAt: now, updatedAt: now,
    setup: { ...setup }, draft: { a: '', b: '', length: '', distance: '', unit }, trials: [],
  };
}
export function createNotebook(): Notebook {
  const session = createSession('mm');
  return { version: 1, unit: 'mm', activeId: session.id, sessions: [session] };
}
