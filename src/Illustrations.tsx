import { useId } from 'react';
import { rotation } from './domain';
import type { Draft, Setup } from './domain';
import { stripGeometry } from './strip-geometry';

export function Mark({ small = false }: { small?: boolean }) {
  return <svg width={small ? 26 : 44} height={small ? 26 : 44} viewBox="0 0 64 64" aria-hidden="true"><path d="M9 8v47h47M19 8v37h37M29 8v27h27M39 8v17h17M49 8v7h7" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

export function SetupThumb({ setup, emphasis }: { setup: Setup; emphasis: keyof Setup }) {
  const bladeX = setup.board === 'left' ? 81 : 39;
  const y = setup.fence === 'near' ? 46 : 18;
  const boardY = setup.fence === 'near' ? 12 : 21;
  return <svg viewBox="0 0 120 64" aria-hidden="true" className="setup-thumb">
    <rect x={setup.board === 'left' ? 35 : 45} y={boardY} width="40" height="22" fill="currentColor" opacity=".06" stroke="currentColor" />
    <path d={`M${bladeX} 5v53`} stroke="currentColor" strokeWidth={emphasis === 'board' ? 2 : 1} strokeDasharray="3 2" />
    <path d={`M17 ${y}H103`} stroke="currentColor" strokeWidth={emphasis === 'fence' ? 4 : 2} />
    <circle cx={setup.pivot === 'left' ? 21 : 99} cy={y} r={emphasis === 'pivot' ? 5 : 3} fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
    {emphasis === 'pivot' && <path d={`M${setup.pivot === 'left' ? 99 : 21} ${y - 10}v20m-3-17 3-3 3 3m-6 14 3 3 3-3`} stroke="currentColor" fill="none" />}
  </svg>;
}

const handwrittenDigits = [
  'M-5-5 1-10 0 10M-5 11l10-1',
  'M-6-6C-3-14 8-11 6-4 4 1-3 5-7 10L7 9',
  'M-6-8C0-13 9-10 5-4L-1 0C10-3 9 11 1 11L-6 9',
  'M2-11-7 3 7 2M4-9 2 11',
];

export function BenchDiagram({ setup, step }: { setup: Setup; step: number }) {
  const id = useId().replace(/:/g, '');
  const left = setup.board === 'left';
  const near = setup.fence === 'near';
  const clockwise = rotation(setup) === 'clockwise';
  const bx = left ? 298 : 202;
  const boardX = left ? bx - 158 : bx + 8;
  const boardY = near ? 78 : 100;
  const fy = near ? 242 : 92;
  const pivot = setup.pivot === 'left' ? 70 : 430;
  const cutIndex = left ? 1 : 3;
  // Coordinates belong to the unturned panel, just like the handwritten “up”.
  // Number the edges in cutting order; rotating the parent moves and turns the
  // same four markings, including returning to edge 1 for the fifth cut.
  const labels = [1, 2, 3, 4].map(number => {
    const edge = (cutIndex - (clockwise ? 1 : -1) * (number - 1) + 4) % 4;
    return { number, x: [0, 58, 0, -58][edge], y: [-57, 0, 57, 0][edge] };
  });
  return <svg className="bench-diagram" viewBox="0 0 500 325" role="img" aria-label={`Top view. Board ${setup.board} of blade, fence at ${setup.fence} edge, pivot at ${setup.pivot}. Cut ${step}. Rotate ${rotation(setup)} between cuts.`}>
    <defs>
      <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0v5" stroke="currentColor" strokeWidth=".7" opacity=".22" /></pattern>
      <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="currentColor" /></marker>
    </defs>
    <text x="26" y="27" className="diagram-kicker">PLAN VIEW · LOOKING DOWN</text>
    <path d="M33 170v-48" fill="none" stroke="currentColor" markerEnd={`url(#${id}-arrow)`} />
    <text x="22" y="194" className="diagram-small">FEED</text>
    <path d={`M${bx} 45V276`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 4" />
    <text x={bx + 10} y="55" className="diagram-small">BLADE</text>
    <rect x={boardX} y={boardY} width="150" height="156" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
    <g key={`${left}-${near}`} transform={`translate(${boardX + 75} ${boardY + 78})`}>
      <g className="panel-mark" data-rotation={(step - 1) * (clockwise ? 90 : -90)} style={{ transform: `rotate(${(step - 1) * (clockwise ? 90 : -90)}deg)` }}>
        <rect x="-61" y="-64" width="122" height="128" fill="none" stroke="currentColor" strokeDasharray="2 5" opacity=".2" />
        {labels.map(({ number, x, y }) => <g key={number} className="handwritten-edge" data-edge={number} data-x={x} data-y={y} role="img" aria-label={`Handwritten edge ${number}`} transform={`translate(${x} ${y})`}>
          <path d={handwrittenDigits[number - 1]} transform="rotate(-6)" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>)}
        <g className="handwritten-up" role="img" aria-label="Handwritten up marking" transform="rotate(-8)">
          <path d="M-26-12c-2 10-6 27 2 29 10 2 17-20 18-30l-5 30M6 35l8-50-4 18c5-20 25-19 24-5-1 12-12 18-24 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-31 25l27-2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      </g>
    </g>
    <path d={`M${left ? boardX + 150 : boardX} ${boardY}v156`} stroke="currentColor" strokeWidth="3" />
    {step > 1 && <g transform={`translate(${left ? 405 : 95} 162)`}>
      <path d={clockwise ? 'M-17-15A23 23 0 1 1 -22 7' : 'M-22 7A23 23 0 1 0 -17-15'} fill="none" stroke="currentColor" strokeWidth="1.2" markerEnd={`url(#${id}-arrow)`} />
      <text x="0" y="4" textAnchor="middle" className="board-title">¼</text>
      <text x="0" y="42" textAnchor="middle" className="diagram-small">{clockwise ? 'CLOCKWISE' : 'ANTICLOCKWISE'}</text>
    </g>}
    {step === 5 && <g>
      <path d={left ? `M${bx + 4} ${boardY}l9 0 4 156h-13Z` : `M${bx - 4} ${boardY}h-9l-4 156h13Z`} fill={`url(#${id}-hatch)`} stroke="currentColor" />
      <path d={`M${bx + (left ? 18 : -18)} ${boardY + 6}h${left ? 18 : -18}M${bx + (left ? 21 : -21)} ${boardY + 148}h${left ? 15 : -15}`} stroke="currentColor" />
      <text x={bx + (left ? 45 : -45)} y={boardY + 10} textAnchor="middle" className="end-label">A</text>
      <text x={bx + (left ? 45 : -45)} y={boardY + 153} textAnchor="middle" className="end-label">B</text>
    </g>}
    <rect x="60" y={fy} width="380" height="9" fill="var(--ink)" />
    <circle cx={pivot} cy={fy + 4.5} r="7" stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
    <circle cx={pivot} cy={fy + 4.5} r="2" fill="var(--ink)" />
    <text x={pivot} y={near ? 273 : 80} textAnchor="middle" className="diagram-small">PIVOT</text>
    <text x="250" y={near ? 270 : 80} textAnchor="middle" className="diagram-small">FENCE</text>
    <path d="M217 306h66m-33-6v12" stroke="currentColor" opacity=".4" />
    <text x="250" y="292" textAnchor="middle" className="diagram-small">YOU ARE HERE</text>
  </svg>;
}

export function StripDiagram({ draft, setup }: { draft: Draft; setup: Setup }) {
  const g = stripGeometry(draft, setup);
  return <svg viewBox="0 0 100 300" role="img" aria-label={`Fifth-cut strip, straight cut edge on the ${g.straightEdge}. A at the far end, B at the near end. ${g.proportional ? 'Drawn in proportion to A, B and L.' : 'Enter A, B and L to scale the drawing.'}`} className="strip-diagram" data-proportional={g.proportional} data-straight-edge={g.straightEdge}>
    <text x="45" y="18" textAnchor="middle" className="diagram-small">FIFTH CUT</text>
    <path className="strip-outline" d={`M${g.leftA} ${g.yA}H${g.rightA}L${g.rightB} ${g.yB}H${g.leftB}Z`} fill="var(--wood)" stroke="currentColor" strokeWidth="1.1" />
    <path className="dimension-a" d={`M0 55H12V${g.yA}H${g.leftA}M${g.rightA} ${g.yA}H89`} stroke="currentColor" strokeDasharray="2 3" fill="none" />
    <path className="dimension-b" d={`M0 255H12V${g.yB}H${g.leftB}M${g.rightB} ${g.yB}H89`} stroke="currentColor" strokeDasharray="2 3" fill="none" />
    <path className="dimension-a" d={`M${g.leftA} ${g.yA - 5}v10m0-5H${g.rightA}m0-5v10`} stroke="currentColor" fill="none" />
    <path className="dimension-b" d={`M${g.leftB} ${g.yB - 5}v10m0-5H${g.rightB}m0-5v10`} stroke="currentColor" fill="none" />
    <path d={`M84 ${g.yA}V${g.yB}M81 ${g.yA + 5}l3-5 3 5M81 ${g.yB - 5}l3 5 3-5M84 155h16`} stroke="currentColor" fill="none" />
  </svg>;
}

export function PivotDistanceDiagram({ setup }: { setup: Setup }) {
  const pivotX = setup.pivot === 'left' ? 36 : 324;
  const adjustX = setup.pivot === 'left' ? 324 : 36;
  return <svg viewBox="0 0 360 102" role="img" aria-label={`D runs along the fence from the fixed ${setup.pivot} pivot to the ${setup.pivot === 'left' ? 'right' : 'left'} adjustment point.`} className="pivot-distance-diagram">
    <path d="M30 35H330" stroke="currentColor" strokeWidth="5" />
    <circle cx={pivotX} cy="35" r="6" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
    <circle cx={pivotX} cy="35" r="1.5" fill="currentColor" />
    <path d={`M${adjustX} 27v16`} stroke="currentColor" strokeWidth="1.5" />
    <text x={pivotX} y="15" textAnchor="middle" className="diagram-small">PIVOT</text>
    <text x={adjustX} y="15" textAnchor="middle" className="diagram-small">ADJUST</text>
    <path d="M36 44v36M324 44v36M180 73v29" stroke="currentColor" strokeDasharray="2 4" opacity=".55" />
    <path d="M36 72H324m-282-3-6 3 6 3m276-6 6 3-6 3" stroke="currentColor" fill="none" />
  </svg>;
}

export function AdjustmentDiagram({ setup, move }: { setup: Setup; move: number }) {
  const id = useId().replace(/:/g, '');
  const px = setup.pivot === 'left' ? 45 : 315;
  const ax = setup.pivot === 'left' ? 315 : 45;
  const offset = Math.abs(move) < 1e-10 ? 0 : move > 0 ? -24 : 24;
  return <svg className="adjustment-diagram" viewBox="0 0 360 155" role="img" aria-label={`Keep the ${setup.pivot} pivot fixed. ${offset === 0 ? 'No adjustment indicated.' : `Move the other end ${move > 0 ? 'away from' : 'toward'} you.`} D is the pivot-to-adjustment distance.`}>
    <defs><marker id={`${id}-tip`} markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0 0 5 3 0 6" fill="none" stroke="currentColor" /></marker></defs>
    <text x="180" y="15" textAnchor="middle" className="diagram-small">AWAY FROM YOU ↑</text>
    <path d={`M${px} 72H${ax}`} stroke="currentColor" strokeDasharray="3 3" opacity=".4" />
    <path className={offset ? 'fence-motion adjustment-direction' : ''} style={{ transformOrigin: `${px}px 72px`, '--turn': `${Math.atan2(-offset, Math.abs(ax - px)) * (px < ax ? -1 : 1) * 180 / Math.PI}deg` } as React.CSSProperties} d={`M${px} 72H${ax}`} stroke="currentColor" strokeWidth="5" />
    <circle cx={px} cy="72" r="6" fill="var(--paper)" stroke="currentColor" strokeWidth="2" />
    {offset !== 0 && <path className="adjustment-direction" d={`M${ax} ${72 - offset / 3}v${offset * 1.6}`} stroke="currentColor" strokeWidth="1.5" markerEnd={`url(#${id}-tip)`} />}
    <text x={px} y="111" textAnchor="middle" className="diagram-small">FIXED</text>
    <text x={ax} y="111" textAnchor="middle" className="diagram-small">ADJUST</text>
    <path d="M75 126h210m-210-3v6m210-6v6" stroke="currentColor" opacity=".4" />
    <rect x="164" y="117" width="32" height="18" fill="var(--paper)" /><text x="180" y="131" textAnchor="middle" className="diagram-small">D</text>
    <text x="180" y="151" textAnchor="middle" className="diagram-small">↓ TOWARD YOU</text>
  </svg>;
}
