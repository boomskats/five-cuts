import { describe, expect, it } from 'vitest';
import { area, cutFrame, cutModel, FIFTH_STRIP_WIDTH, INITIAL_PANEL, materialEdge, rotatedBounds, SHAVING_WIDTH, width } from './cut-animation';
import type { Setup } from './domain';

for (const board of ['left', 'right'] as const) for (const fence of ['near', 'far'] as const) for (const pivot of ['left', 'right'] as const) {
  const setup: Setup = { board, fence, pivot };
  describe(`cut animation: ${board}/${fence}/${pivot}`, () => {
    it('conserves material and retains each preceding cut through the fifth', () => {
      let previous = INITIAL_PANEL;
      for (let step = 1; step <= 5; step++) {
        const model = cutModel(setup, step);
        expect(model.before).toEqual(previous);
        expect(area(model.after)).toBeLessThan(area(model.before));
        expect(area(model.after) + area(model.offcut)).toBe(area(model.before));
        expect(model.amount).toBe(step === 5 ? FIFTH_STRIP_WIDTH : SHAVING_WIDTH);
        expect(width(model.worldOffcut)).toBe(model.amount);
        // Permanent handwriting stays within the retained material, not rescaled.
        expect(model.after.left).toBeLessThan(-67);
        expect(model.after.right).toBeGreaterThan(67);
        expect(model.after.top).toBeLessThan(-68);
        expect(model.after.bottom).toBeGreaterThan(68);
        previous = model.after;
      }
      expect(materialEdge(setup, 5)).toBe(materialEdge(setup, 1));
      expect(area(previous)).toBe(152 * 166);
    });
    it('seats the panel at the fence and cuts exactly along the blade', () => {
      for (let step = 1; step <= 5; step++) {
        const model = cutModel(setup, step);
        const settled = rotatedBounds(model.after, model.target.angle);
        expect(model.target.x + (board === 'left' ? settled.right : settled.left)).toBe(model.bladeX);
        expect(model.target.y + (fence === 'near' ? settled.bottom : settled.top)).toBe(fence === 'near' ? model.fenceY : model.fenceY + 9);
      }
    });
    it('clears the blade and fence throughout every quarter-turn', () => {
      for (let step = 2; step <= 5; step++) {
        const model = cutModel(setup, step);
        for (let time = 250; time <= 1000; time += 30) {
          const frame = cutFrame(model, time);
          const angle = frame.pose.angle * Math.PI / 180;
          for (const x of [model.before.left, model.before.right]) for (const y of [model.before.top, model.before.bottom]) {
            const px = frame.pose.x + x * Math.cos(angle) - y * Math.sin(angle);
            const py = frame.pose.y + x * Math.sin(angle) + y * Math.cos(angle);
            expect(board === 'left' ? px < model.bladeX : px > model.bladeX).toBe(true);
            expect(fence === 'near' ? py < model.fenceY : py > model.fenceY + 9).toBe(true);
            expect(px).toBeGreaterThan(0); expect(px).toBeLessThan(500);
            expect(py).toBeGreaterThan(0); expect(py).toBeLessThan(400);
          }
        }
      }
    });
    it('finishes once, has the same final state on replay and supports direct step selection', () => {
      const model = cutModel(setup, 5);
      expect(cutFrame(model, 100).phase).toBe('lifting');
      expect(cutFrame(model, 500).phase).toBe('rotating');
      expect(cutFrame(model, 1200).phase).toBe('seating');
      expect(cutFrame(model, 1900).phase).toBe('cutting');
      expect(cutFrame(model, 2700).phase).toBe('separating');
      expect(cutFrame(model, model.duration)).toEqual(cutFrame(model, 100_000));
      expect(cutFrame(model, model.duration).bounds).toEqual(model.after);
      expect(cutFrame(model, 0).bounds).toEqual(model.before);
      expect(cutFrame(cutModel(setup, 1), 0).phase).toBe('seating');
    });
  });
}

it('rejects invalid cut steps', () => {
  const setup: Setup = { board: 'left', fence: 'near', pivot: 'left' };
  for (const step of [0, 6, 1.5, NaN]) expect(() => cutModel(setup, step)).toThrow('Cut must be 1–5');
});
