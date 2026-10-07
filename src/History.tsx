import { useState } from 'react';
import { calculate, format, formatInput, fromMM, parseDecimal, toMM } from './domain';
import type { MoveDirection, Trial, Unit } from './domain';
import { MoveField } from './MoveField';

export function timestamp(value: string, short = false) {
  return new Intl.DateTimeFormat(undefined, short
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Plot({ trials, unit, kind }: { trials: Trial[]; unit: Unit; kind: 'taper' | 'movement' }) {
  const series = trials.map(t => fromMM(kind === 'taper' ? t.measurements.a - t.measurements.b : calculate(t.measurements, t.setup).move, unit));
  const actual = trials.map(t => t.actualMove === null ? null : fromMM(t.actualMove, unit));
  const all = kind === 'movement' ? [...series, ...actual.filter((v): v is number => v !== null)] : series;
  const bound = Math.max(...all.map(Math.abs), unit === 'mm' ? .01 : .001) * 1.18;
  const x = (i: number) => trials.length === 1 ? 235 : 50 + i / (trials.length - 1) * 370;
  const y = (v: number) => 92 - v / bound * 58;
  const points = series.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const label = kind === 'taper' ? 'Measured taper, A minus B' : 'Fence movement, recommended and actual';
  return <div className="plot">
    <div className="plot-heading"><h3>{kind === 'taper' ? 'Strip taper' : 'Fence moves'}</h3><span>{unit}</span></div>
    <svg viewBox="0 0 450 190" role="img" aria-label={`${label} in ${unit}. Exact values are listed in the trial records below.`}>
      {[-.75, 0, .75].map(f => <g key={f}>
        <path d={`M50 ${y(bound * f)}H430`} stroke="currentColor" opacity={f === 0 ? '.35' : '.1'} strokeDasharray={f === 0 ? '3 4' : undefined} />
        <text x="41" y={y(bound * f) + 3} textAnchor="end">{Number((bound * f).toFixed(unit === 'mm' ? 3 : 4))}</text>
      </g>)}
      <polyline className={kind === 'movement' ? 'recommended-series' : undefined} points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={kind === 'movement' ? '4 4' : undefined} />
      {series.map((v, i) => <g key={trials[i].id}>
        <circle className={kind === 'movement' ? 'recommended-series' : undefined} cx={x(i)} cy={y(v)} r="4" fill="var(--paper)" stroke="currentColor"><title>Test {i + 1}: {v.toFixed(5)} {unit}</title></circle>
        {(trials.length < 12 || i === 0 || i === trials.length - 1 || i % Math.ceil(trials.length / 10) === 0) && <text x={x(i)} y="172" textAnchor="middle">{i + 1}</text>}
      </g>)}
      {kind === 'movement' && actual.map((v, i) => v !== null && <g className="actual-series" key={trials[i].id}>
        {i > 0 && actual[i - 1] !== null && <path d={`M${x(i - 1)} ${y(actual[i - 1]!)}L${x(i)} ${y(v)}`} stroke="currentColor" strokeWidth="2" />}
        <rect x={x(i) - 3} y={y(v) - 3} width="6" height="6" fill="currentColor"><title>Test {i + 1}, actual move: {v.toFixed(5)} {unit}</title></rect>
      </g>)}
      <text x="240" y="187" textAnchor="middle" className="plot-axis">TEST NUMBER</text>
    </svg>
    <p className="plot-caption">{kind === 'taper' ? 'A − B. Zero is square.' : '○ Suggested  ■ Made · + away, − toward you'}</p>
  </div>;
}

function ActualMove({ trial, number, unit, onSave }: { trial: Trial; number: number; unit: Unit; onSave: (move: number | null) => void }) {
  const recommendation = calculate(trial.measurements, trial.setup).move;
  const suggestedAmount = formatInput(Math.abs(fromMM(recommendation, unit)), unit);
  const suggestedDirection: MoveDirection = recommendation < 0 ? 'toward' : 'away';
  const [amount, setAmount] = useState(trial.actualMove === null ? '' : formatInput(Math.abs(fromMM(trial.actualMove, unit)), unit));
  const [direction, setDirection] = useState<MoveDirection>((trial.actualMove ?? recommendation) < 0 ? 'toward' : 'away');
  const parsed = parseDecimal(amount);
  const suggested = amount === suggestedAmount && direction === suggestedDirection;
  return <form className="actual-form" onSubmit={e => {
    e.preventDefault();
    if (amount === '') onSave(null);
    else if (suggested) onSave(recommendation);
    else if (parsed !== null) onSave(toMM(parsed, unit) * (direction === 'away' ? 1 : -1));
  }}>
    <MoveField id={`actual-${trial.id}`} label={`Move made after test ${number}`} unit={unit} amount={amount} direction={direction} suggested={suggested} onChange={(a, d) => { setAmount(a); setDirection(d); }} onReset={() => { setAmount(suggestedAmount); setDirection(suggestedDirection); }} />
    <button className="button small" type="submit" disabled={amount !== '' && parsed === null}>Save move</button>
  </form>;
}

export function History({ trials, unit, onMove, onDelete }: { trials: Trial[]; unit: Unit; onMove: (id: string, move: number | null) => void; onDelete: (id: string) => void }) {
  return <section className="history" aria-labelledby="tests-title">
    <div className="section-heading"><h3 id="tests-title">Tests</h3></div>
    {!trials.length ? <p className="empty-notebook">No tests yet.</p> : <>
      <div className="plots"><Plot trials={trials} unit={unit} kind="taper" /><Plot trials={trials} unit={unit} kind="movement" /></div>
      <div className="trial-list">{trials.map((trial, index) => {
        const result = calculate(trial.measurements, trial.setup);
        const previous = trials[index - 1];
        const delta = previous ? result.taper - (previous.measurements.a - previous.measurements.b) : null;
        return <details className="trial" key={trial.id} open={index === trials.length - 1 ? true : undefined}>
          <summary><span className="trial-number">{String(index + 1).padStart(2, '0')}</span><span className="trial-time">{timestamp(trial.createdAt, true)}<small>{new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(trial.createdAt))}</small></span><span className="trial-taper">{format(result.taper, unit, true)} <small>{unit} taper</small></span><span className="trial-delta">{delta === null ? 'First test' : `Change: ${format(delta, unit, true)} ${unit}`}</span><span className="disclosure" aria-hidden="true">＋</span></summary>
          <div className="trial-body">
            <dl className="trial-measurements"><div><dt>A · far</dt><dd>{format(trial.measurements.a, unit)} {unit}</dd></div><div><dt>B · near</dt><dd>{format(trial.measurements.b, unit)} {unit}</dd></div><div><dt>L · measured span</dt><dd>{format(trial.measurements.length, unit)} {unit}</dd></div><div><dt>D · pivot distance</dt><dd>{format(trial.measurements.distance, unit)} {unit}</dd></div></dl>
            <p className="trial-recommendation">Suggested move: <strong>{format(Math.abs(result.move), unit)} {unit}{result.direction === 'none' ? ' · no move' : ` ${result.direction === 'away' ? 'away from' : 'toward'} you`}</strong> at the {trial.setup.pivot === 'left' ? 'right' : 'left'} adjustment point.</p>
            <ActualMove key={`${trial.id}-${trial.actualMove}-${unit}`} trial={trial} number={index + 1} unit={unit} onSave={move => onMove(trial.id, move)} />
            <button className="text-button delete-trial" onClick={() => onDelete(trial.id)}>Delete test {index + 1}</button>
          </div>
        </details>;
      })}</div>
    </>}
  </section>;
}
