import { describe, expect, it } from 'vitest';
import { calculate, convertDraft, createNotebook, format, fromMM, parseDecimal, readMeasurements, rotation, toMM } from './domain';
import type { Setup } from './domain';

const sample = { a: 8.12, b: 8, length: 300, distance: 600 };
describe('five-cut geometry', () => {
  it('matches the standard small-angle example', () => {
    const result = calculate(sample, { board: 'left', fence: 'near', pivot: 'left' });
    expect(result.move).toBeCloseTo(.06, 7);
    expect(result.direction).toBe('away');
    expect(result.taper).toBeCloseTo(.12, 9);
  });
  for (const board of ['left', 'right'] as const) {
    for (const fence of ['near', 'far'] as const) {
      for (const pivot of ['left', 'right'] as const) {
        for (const alpha of [-.018, -.001, .0001, .003, .018]) {
          it(`recovers a ${alpha} rad fence: board ${board}, fence ${fence}, pivot ${pivot}`, () => {
            // Independent geometric construction. Rotate a vertical first-cut edge
            // four times, each time aligning the new cut's inward normal with the
            // fence's inward normal. No calculator formula is used to generate data.
            const setup: Setup = { board, fence, pivot };
            const newEdgeNormal = board === 'left' ? [-1, 0] : [1, 0];
            const referenceNormal = [-Math.sin(alpha), Math.cos(alpha)].map(n => fence === 'near' ? n : -n);
            const turn = Math.atan2(newEdgeNormal[0] * referenceNormal[1] - newEdgeNormal[1] * referenceNormal[0], newEdgeNormal[0] * referenceNormal[0] + newEdgeNormal[1] * referenceNormal[1]);
            const rotate = ([x, y]: number[]) => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)];
            let ends = [[0, -200], [0, 200]];
            for (let n = 0; n < 4; n++) ends = ends.map(rotate);
            ends.sort((a, b) => a[1] - b[1]);
            const [nearEnd, farEnd] = ends;
            const stripSign = board === 'left' ? 1 : -1;
            const readings = { a: 40 + stripSign * farEnd[0], b: 40 + stripSign * nearEnd[0], length: farEnd[1] - nearEnd[1], distance: 650 };
            const result = calculate(readings, setup);
            expect(result.errorDegrees * Math.PI / 180).toBeCloseTo(alpha, 11);
            const pivotSign = pivot === 'left' ? 1 : -1;
            const adjustmentYBefore = pivotSign * readings.distance * Math.sin(alpha);
            expect(adjustmentYBefore + result.move).toBeCloseTo(0, 9);
            expect(rotation(setup)).toBe(turn < 0 ? 'clockwise' : 'anticlockwise');
          });
        }
      }
    }
  }
  it('equal ends indicate no movement without NaN', () => {
    const r = calculate({ ...sample, a: 8 }, { board: 'right', fence: 'far', pivot: 'right' });
    expect(r.move).toBe(0); expect(r.direction).toBe('none');
  });
  it('swapping A and B reverses the move', () => {
    const setup: Setup = { board: 'left', fence: 'near', pivot: 'left' };
    expect(calculate(sample, setup).move).toBe(-calculate({ ...sample, a: sample.b, b: sample.a }, setup).move);
  });
});
describe('measurements and units', () => {
  it.each(['1/4', '1 1/4', '-3', '1e3', '2mm', 'Infinity', 'NaN', '', '.', '1,2,3'])('rejects ambiguous input %s', raw => expect(parseDecimal(raw)).toBeNull());
  it.each([['1,25', 1.25], [' .5 ', .5], ['3.', 3], ['0', 0]])('parses %s', (raw, value) => expect(parseDecimal(String(raw))).toBe(value));
  it('converts mm to decimal inches without reinterpreting values', () => {
    const draft = { a: '25.4', b: '12.7', length: '254', distance: '508', unit: 'mm' as const };
    const converted = convertDraft(draft, 'in');
    expect(converted).toMatchObject({ a: '1', b: '0.5', length: '10', distance: '20', unit: 'in' });
    expect(readMeasurements(converted)).toEqual(readMeasurements(draft));
    expect(convertDraft(converted, 'mm')).toMatchObject(draft);
    expect(fromMM(toMM(.1234, 'in'), 'in')).toBeCloseTo(.1234, 12);
  });
  it('does not treat placeholders or invalid dimensions as readings', () => {
    const draft = { a: '', b: '', length: '', distance: '', unit: 'mm' as const };
    expect(readMeasurements(draft)).toBeNull();
    expect(readMeasurements({ ...draft, a: '0', b: '1', length: '300', distance: '500' })).toBeNull();
    expect(readMeasurements({ ...draft, a: '400', b: '8', length: '300', distance: '500' })).toBeNull();
    expect(readMeasurements({ ...draft, a: '80', b: '8', length: '300', distance: '500' })).toBeNull();
  });
  it('keeps sub-resolution moves distinct from true zero', () => {
    expect(format(.00001, 'mm')).toBe('<0.001');
    expect(format(0, 'mm')).toBe('0.000');
    expect(format(-.00001, 'mm')).toBe('−<0.001');
  });
  it('starts a timestamped metric notebook with a valid active session', () => {
    const n = createNotebook();
    expect(n.unit).toBe('mm'); expect(n.sessions[0].id).toBe(n.activeId);
    expect(Number.isNaN(Date.parse(n.sessions[0].createdAt))).toBe(false);
  });
});
