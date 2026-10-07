import { useId } from 'react';
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

export { BenchDiagram } from './BenchDiagram';

export function StripDiagram({ draft, setup }: { draft: Draft; setup: Setup }) {
  const g = stripGeometry(draft, setup);
  return <svg viewBox="0 0 100 300" role="img" aria-label={`Fifth-cut strip, straight cut edge on the ${g.straightEdge}. A at the far end, B at the near end. ${g.proportional ? 'Drawn in proportion to A, B and L.' : 'Enter A, B and L to scale the drawing.'}`} className="strip-diagram" data-proportional={g.proportional} data-straight-edge={g.straightEdge}>
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
