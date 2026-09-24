import { draftValueMM } from './domain';
import type { Draft, Setup } from './domain';

/** Fit a true-aspect-ratio measured section into the central drawing column. */
export function stripGeometry(draft: Draft, setup: Setup) {
  const a = draftValueMM(draft, 'a');
  const b = draftValueMM(draft, 'b');
  const length = draftValueMM(draft, 'length');
  const proportional = [a, b, length].every(v => v !== null && Number.isFinite(v) && v > 0);
  const A = proportional ? a! : 30;
  const B = proportional ? b! : 22;
  const L = proportional ? length! : 200;
  const scale = Math.min(200 / L, 54 / Math.max(A, B));
  const span = L * scale;
  const widthA = A * scale;
  const widthB = B * scale;
  const maxWidth = Math.max(widthA, widthB);
  const yA = 155 - span / 2;
  const yB = 155 + span / 2;
  const straightEdge = setup.board === 'left' ? 'left' : 'right';
  const straightX = straightEdge === 'left' ? 45 - maxWidth / 2 : 45 + maxWidth / 2;
  const leftA = straightEdge === 'left' ? straightX : straightX - widthA;
  const rightA = straightEdge === 'right' ? straightX : straightX + widthA;
  const leftB = straightEdge === 'left' ? straightX : straightX - widthB;
  const rightB = straightEdge === 'right' ? straightX : straightX + widthB;
  return { proportional, straightEdge, straightX, leftA, rightA, leftB, rightB, yA, yB, span, widthA, widthB, scale };
}
