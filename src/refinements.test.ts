import { describe, expect, it } from 'vitest';
import { convertDraft, createNotebook, draftValueMM, formatInput, readMeasurements, setDraftField } from './domain';
import type { Draft, Setup } from './domain';
import { isNotebook } from './storage';
import { stripGeometry } from './strip-geometry';

const draft: Draft = { a: '8.123456789', b: '8', length: '300', distance: '400', unit: 'mm' };
describe('clean conversion without accumulated rounding', () => {
  it('keeps 400 exactly after 100 unit roundtrips, including persistence', () => {
    let current = draft;
    for (let i = 0; i < 100; i++) {
      current = JSON.parse(JSON.stringify(convertDraft(current, 'in')));
      current = convertDraft(current, 'mm');
    }
    expect(current.distance).toBe('400');
    expect(current.a).toBe('8.123457');
    expect(readMeasurements(current)).toEqual(readMeasurements(draft));
  });
  it('cleans existing floating-point display artifacts on load', () => {
    expect(convertDraft({ ...draft, distance: '399.99999998' }, 'mm').distance).toBe('400');
    expect(formatInput(0.30000000000000004, 'mm')).toBe('0.3');
    expect(formatInput(1e-9, 'mm')).toBe('0.000000001');
  });
  it('honors a new user edit instead of an earlier hidden precise value', () => {
    const converted = convertDraft(draft, 'in');
    const edited = setDraftField(converted, 'distance', '16');
    expect(edited.exactMM?.distance).toBeUndefined();
    expect(convertDraft(edited, 'mm').distance).toBe('406.4');
    // Defensive stale-cache check, even if another caller updates a field directly.
    expect(draftValueMM({ ...converted, distance: '16' }, 'distance')).toBe(406.4);
  });
  it('validates precise backing values in backups without breaking older notebooks', () => {
    const n = createNotebook();
    expect(isNotebook(n)).toBe(true);
    n.sessions[0].draft = convertDraft(draft, 'mm');
    expect(isNotebook(n)).toBe(true);
    n.sessions[0].draft.exactMM!.distance!.value = 999;
    expect(isNotebook(n)).toBe(false);
  });
});

describe('strip geometry', () => {
  for (const board of ['left', 'right'] as const) for (const fence of ['near', 'far'] as const) for (const pivot of ['left', 'right'] as const) {
    it(`mirrors the straight edge and preserves proportions: ${board}/${fence}/${pivot}`, () => {
      const setup: Setup = { board, fence, pivot };
      for (const [a, b, length] of [[8, 7, 300], [7, 8, 100], [90, 90, 100]]) {
        const geometry = stripGeometry({ ...draft, a: String(a), b: String(b), length: String(length) }, setup);
        expect(geometry.proportional).toBe(true);
        expect(geometry.widthA / geometry.span).toBeCloseTo(a / length, 10);
        expect(geometry.widthB / geometry.span).toBeCloseTo(b / length, 10);
        if (board === 'left') expect(geometry.leftA).toBe(geometry.leftB);
        else expect(geometry.rightA).toBe(geometry.rightB);
        expect(geometry.span).toBeLessThanOrEqual(200);
        expect(Math.max(geometry.widthA, geometry.widthB)).toBeLessThanOrEqual(54);
      }
    });
  }
  it('uses a finite schematic for incomplete values and ignores D for shape scaling', () => {
    const setup: Setup = { board: 'left', fence: 'near', pivot: 'left' };
    expect(stripGeometry({ ...draft, a: '' }, setup).proportional).toBe(false);
    expect(stripGeometry({ ...draft, distance: '' }, setup).proportional).toBe(true);
    expect(stripGeometry(convertDraft(draft, 'in'), setup)).toEqual(stripGeometry(draft, setup));
  });
});
