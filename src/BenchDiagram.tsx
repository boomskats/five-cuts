import { useId, useMemo, useState } from 'react';
import { rotation } from './domain';
import type { Setup } from './domain';
import { cutFrame, cutModel, height, width } from './cut-animation';
import { PanelMarkings } from './PanelMarkings';
import { useCutAnimation } from './useCutAnimation';

export function BenchDiagram({ setup, step }: { setup: Setup; step: number }) {
  const id = useId().replace(/:/g, '');
  const [replay, setReplay] = useState(0);
  const model = useMemo(() => cutModel(setup, step), [setup.board, setup.fence, setup.pivot, step]);
  const animationKey = `${setup.board}-${setup.fence}-${setup.pivot}-${step}-${replay}`;
  const { elapsed, reduced } = useCutAnimation(animationKey, model.duration);
  const frame = cutFrame(model, elapsed);
  const left = setup.board === 'left';
  const near = setup.fence === 'near';
  const clockwise = rotation(setup) === 'clockwise';
  const pivot = setup.pivot === 'left' ? 70 : 430;
  const separated = frame.phase === 'separating' || frame.phase === 'complete';
  const showOffcut = frame.phase === 'cutting' || frame.phase === 'separating' || (step === 5 && frame.phase === 'complete');
  const piece = model.worldOffcut;
  const driftX = -model.awayX * (step === 5 ? 34 : 24) * frame.releaseProgress;
  const driftY = step === 5 ? 0 : 10 * frame.releaseProgress;
  const pieceAngle = step === 5 ? 0 : -model.awayX * 8 * frame.releaseProgress;
  const phaseText = {
    lifting: 'Lift the panel clear', rotating: `Turn ${rotation(setup)}`, seating: 'Seat against the fence',
    cutting: step === 5 ? 'Cut the strip from edge 1' : `Trim edge ${step}`, separating: step === 5 ? 'Keep the strip for measuring' : 'Remove the shaving', complete: step === 5 ? 'Make cut 5, then measure A and B' : `Make cut ${step}, then tap Next`,
  }[frame.phase];
  return <div className="bench-visual">
    <svg className="bench-diagram" viewBox="0 38 500 362" role="img" aria-label={`Top view. Board ${setup.board} of blade, fence at ${setup.fence} edge, pivot at ${setup.pivot}. Cut ${step}. Rotate ${rotation(setup)} between cuts.`} data-phase={frame.phase} data-cut={step} data-replay={replay} data-shaving-width={model.amount} data-cut-progress={frame.cutProgress} data-release-progress={frame.releaseProgress}>
      <defs>
        <pattern id={`${id}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0v5" stroke="var(--clay)" strokeWidth=".8" opacity=".4" /></pattern>
        <marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="none" stroke="currentColor" /></marker>
        <clipPath id={`${id}-cut-reveal`}><rect x={piece.left - 1} y={piece.top - 1} width={width(piece) + 2} height={height(piece) * frame.cutProgress + (frame.cutProgress ? 2 : 0)} /></clipPath>
      </defs>
      <path d="M33 205v-48" fill="none" stroke="currentColor" markerEnd={`url(#${id}-arrow)`} />
      <text x="22" y="229" className="diagram-small">FEED</text>
      <path d={`M${model.bladeX} 45V355`} stroke="currentColor" strokeWidth="1.5" strokeDasharray="7 4" />
      <text x={model.bladeX + 10} y="55" className="diagram-small">BLADE</text>
      <g className="panel-position" transform={`translate(${frame.pose.x} ${frame.pose.y})`}>
        <g className="panel-mark" data-rotation={frame.pose.angle} style={{ transform: `rotate(${frame.pose.angle}deg)` }}>
          <rect className="panel-body" x={frame.bounds.left} y={frame.bounds.top} width={width(frame.bounds)} height={height(frame.bounds)} fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
          <PanelMarkings setup={setup} />
        </g>
      </g>
      {showOffcut && <g className="offcut-piece" data-kind={step === 5 ? 'measurement' : 'shaving'} transform={`translate(${driftX} ${driftY}) rotate(${pieceAngle} ${(piece.left + piece.right) / 2} ${(piece.top + piece.bottom) / 2})`} opacity={step === 5 || !separated ? 1 : 1 - frame.releaseProgress}>
        {separated && <rect className="offcut-strip" x={piece.left} y={piece.top} width={width(piece)} height={height(piece)} fill="var(--wood)" stroke="currentColor" strokeWidth="1.1" />}
        <rect x={piece.left} y={piece.top} width={width(piece)} height={height(piece)} fill={`url(#${id}-hatch)`} clipPath={separated ? undefined : `url(#${id}-cut-reveal)`} />
        {step === 5 && separated && <g className="offcut-labels" opacity={Math.max(0, (frame.releaseProgress - .45) / .55)}>
          <path d={`M${left ? piece.right + 3 : piece.left - 3} ${piece.top + 5}h${left ? 8 : -8}M${left ? piece.right + 3 : piece.left - 3} ${piece.bottom - 5}h${left ? 8 : -8}`} stroke="currentColor" />
          <text x={left ? piece.right + 18 : piece.left - 18} y={piece.top + 10} textAnchor="middle" className="end-label dimension-a">A</text>
          <text x={left ? piece.right + 18 : piece.left - 18} y={piece.bottom - 1} textAnchor="middle" className="end-label dimension-b">B</text>
        </g>}
      </g>}
      {frame.phase === 'cutting' && <g className="cut-trace">
        <path d={`M${model.bladeX} ${model.cutBounds.top}v${height(model.cutBounds) * frame.cutProgress}`} stroke="currentColor" strokeWidth="2.3" />
        <circle cx={model.bladeX} cy={model.cutBounds.top + height(model.cutBounds) * frame.cutProgress} r="2.8" fill="currentColor" />
      </g>}
      {separated && <path className="fresh-edge" d={`M${model.bladeX} ${model.cutBounds.top}V${model.cutBounds.bottom}`} stroke="currentColor" strokeWidth="2" />}
      {step > 1 && <g transform={`translate(${left ? 405 : 95} 200)`}>
        <path d={clockwise ? 'M-17-15A23 23 0 1 1 -22 7' : 'M-22 7A23 23 0 1 0 -17-15'} fill="none" stroke="currentColor" strokeWidth="1.2" markerEnd={`url(#${id}-arrow)`} />
        <text x="0" y="4" textAnchor="middle" className="board-title">¼</text>
        <text x="0" y="42" textAnchor="middle" className="diagram-small">{clockwise ? 'CLOCKWISE' : 'ANTICLOCKWISE'}</text>
      </g>}
      <rect x="60" y={model.fenceY} width="380" height="9" fill="var(--ink)" />
      <circle cx={pivot} cy={model.fenceY + 4.5} r="7" stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
      <circle cx={pivot} cy={model.fenceY + 4.5} r="2" fill="var(--ink)" />
      <text x={pivot} y={near ? 341 : 73} textAnchor="middle" className="diagram-small">PIVOT</text>
      <text x="250" y={near ? 339 : 73} textAnchor="middle" className="diagram-small">FENCE</text>
      <path d="M217 389h66m-33-6v12" stroke="currentColor" opacity=".4" />
      <text x="250" y="375" textAnchor="middle" className="diagram-small">YOU ARE HERE</text>
    </svg>
    <div className="cut-animation-controls"><span className="small-note">{phaseText}</span><button type="button" className="text-button replay-cut" aria-label={`Replay cut ${step}`} disabled={reduced} title={reduced ? 'Animations are off in your device settings' : 'Replay this cut'} onClick={() => setReplay(value => value + 1)}><span aria-hidden="true">↻</span> Replay cut</button></div>
  </div>;
}
