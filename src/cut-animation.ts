import { rotation } from './domain';
import type { Setup } from './domain';

export interface Bounds { left: number; top: number; right: number; bottom: number }
export interface Pose { x: number; y: number; angle: number }
export type CutPhase = 'lifting' | 'rotating' | 'seating' | 'cutting' | 'separating' | 'complete';
export const INITIAL_PANEL: Bounds = { left: -87, top: -87, right: 87, bottom: 87 };
export const SHAVING_WIDTH = 4;
export const FIFTH_STRIP_WIDTH = 14;
export const width = (b: Bounds) => b.right - b.left;
export const height = (b: Bounds) => b.bottom - b.top;
export const area = (b: Bounds) => width(b) * height(b);

export function materialEdge(setup: Setup, cut: number) {
  const bladeEdge = setup.board === 'left' ? 1 : 3; // top, right, bottom, left
  const direction = rotation(setup) === 'clockwise' ? 1 : -1;
  return (bladeEdge - direction * (cut - 1) + 8) % 4;
}
export function trim(bounds: Bounds, edge: number, amount: number) {
  const after = { ...bounds };
  const offcut = { ...bounds };
  if (edge === 0) { after.top += amount; offcut.bottom = after.top; }
  if (edge === 1) { after.right -= amount; offcut.left = after.right; }
  if (edge === 2) { after.bottom -= amount; offcut.top = after.bottom; }
  if (edge === 3) { after.left += amount; offcut.right = after.left; }
  return { after, offcut };
}
export function rotatedBounds(b: Bounds, angle: number): Bounds {
  // Every settled pose is a quarter turn: integer coefficients prevent drift.
  const c = Math.round(Math.cos(angle * Math.PI / 180));
  const s = Math.round(Math.sin(angle * Math.PI / 180));
  const corners = [[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom]].map(([x, y]) => [x * c - y * s, x * s + y * c]);
  return { left: Math.min(...corners.map(p => p[0])), right: Math.max(...corners.map(p => p[0])), top: Math.min(...corners.map(p => p[1])), bottom: Math.max(...corners.map(p => p[1])) };
}
function translated(b: Bounds, pose: Pose): Bounds {
  return { left: b.left + pose.x, right: b.right + pose.x, top: b.top + pose.y, bottom: b.bottom + pose.y };
}
export function cutModel(setup: Setup, step: number) {
  if (!Number.isInteger(step) || step < 1 || step > 5) throw new Error('Cut must be 1–5');
  const direction = rotation(setup) === 'clockwise' ? 1 : -1;
  const bladeX = setup.board === 'left' ? 298 : 202;
  const fenceY = setup.fence === 'near' ? 310 : 85;
  const awayX = setup.board === 'left' ? -1 : 1;
  const awayY = setup.fence === 'near' ? -1 : 1;
  const seat = (bounds: Bounds, angle: number): Pose => {
    const turned = rotatedBounds(bounds, angle);
    return {
      angle,
      x: bladeX - (setup.board === 'left' ? turned.right : turned.left),
      y: setup.fence === 'near' ? fenceY - turned.bottom : fenceY + 9 - turned.top,
    };
  };
  let before = { ...INITIAL_PANEL };
  for (let cut = 1; cut < step; cut++) before = trim(before, materialEdge(setup, cut), SHAVING_WIDTH).after;
  const amount = step === 5 ? FIFTH_STRIP_WIDTH : SHAVING_WIDTH;
  const { after, offcut } = trim(before, materialEdge(setup, step), amount);
  const angle = (step - 1) * direction * 90;
  const target = seat(after, angle);
  const previous = step === 1
    ? { ...target, x: target.x + awayX * 24, y: target.y + awayY * 24 }
    : seat(before, angle - direction * 90);
  const radius = Math.hypot(Math.max(Math.abs(before.left), Math.abs(before.right)), Math.max(Math.abs(before.top), Math.abs(before.bottom)));
  const clear = {
    x: bladeX + awayX * (radius + 8),
    y: (setup.fence === 'near' ? fenceY : fenceY + 9) + awayY * (radius + 8),
    angle: previous.angle,
  };
  return {
    step, before, after, offcut, amount, direction, bladeX, fenceY, awayX, awayY, target, previous, clear,
    cutBounds: translated(rotatedBounds(before, angle), target),
    worldOffcut: translated(rotatedBounds(offcut, angle), target),
    duration: step === 1 ? 1900 : 3000,
  };
}
export type CutModel = ReturnType<typeof cutModel>;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
const between = (from: Pose, to: Pose, p: number): Pose => {
  const t = ease(p);
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, angle: from.angle + (to.angle - from.angle) * t };
};

/** Pure timeline: replay, direct step selection and reduced motion share one final state. */
export function cutFrame(model: CutModel, elapsed: number): { phase: CutPhase; pose: Pose; bounds: Bounds; cutProgress: number; releaseProgress: number } {
  const time = Math.max(0, elapsed);
  const cutStart = model.step === 1 ? 450 : 1400;
  const releaseStart = model.step === 1 ? 1350 : 2400;
  const base = { pose: model.target, bounds: model.before, cutProgress: 0, releaseProgress: 0 };
  if (time >= model.duration) return { ...base, phase: 'complete', bounds: model.after, cutProgress: 1, releaseProgress: 1 };
  if (model.step > 1 && time < 250) return { ...base, phase: 'lifting', pose: between(model.previous, model.clear, time / 250) };
  if (model.step > 1 && time < 1000) return { ...base, phase: 'rotating', pose: between(model.clear, { ...model.clear, angle: model.target.angle }, (time - 250) / 750) };
  if (time < cutStart) return {
    ...base, phase: 'seating',
    pose: model.step === 1 ? between(model.previous, model.target, time / cutStart) : between({ ...model.clear, angle: model.target.angle }, model.target, (time - 1000) / 400),
  };
  if (time < releaseStart) return { ...base, phase: 'cutting', cutProgress: clamp((time - cutStart) / (releaseStart - cutStart)) };
  return { ...base, phase: 'separating', bounds: model.after, cutProgress: 1, releaseProgress: ease((time - releaseStart) / (model.duration - releaseStart)) };
}
