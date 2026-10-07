import { parseDecimal } from './domain';
import type { Draft, Setup, Unit } from './domain';
import { PivotDistanceDiagram, StripDiagram } from './Illustrations';

type Dimension = 'a' | 'b' | 'length' | 'distance';
const fields = {
  a: { title: 'A · far end', label: 'A · far end', description: 'First through the blade', mm: '8.12', in: '0.320' },
  b: { title: 'B · near end', label: 'B · near end', description: 'Last through the blade', mm: '8.00', in: '0.315' },
  length: { title: 'L · span', label: 'L · span', description: 'Between A and B', mm: '300', in: '12' },
  distance: { title: 'D · pivot to adjustment', label: 'D · pivot to adjustment', description: 'Along the fence', mm: '600', in: '24' },
};

export function Measurements({ draft, unit, setup, onChange }: {
  draft: Draft;
  unit: Unit;
  setup: Setup;
  onChange: (key: Dimension, value: string) => void;
}) {
  function field(key: Dimension) {
    const info = fields[key];
    const parsed = parseDecimal(draft[key]);
    const invalid = draft[key] !== '' && (parsed === null || parsed <= 0);
    return <div className={`measurement-field field-${key}`}>
      <label htmlFor={`measure-${key}`}>{info.title}</label>
      <div className={`input-with-unit ${invalid ? 'invalid' : ''}`}>
        <input id={`measure-${key}`} aria-label={info.label} inputMode="decimal" autoComplete="off" value={draft[key]} placeholder={info[unit]} aria-invalid={invalid} aria-describedby={`help-${key}`} onChange={e => onChange(key, e.target.value)} />
        <span>{unit}</span>
      </div>
      <p id={`help-${key}`}>{invalid ? 'Use a positive decimal.' : info.description}</p>
    </div>;
  }
  return <>
    <div className="strip-measurements">
      {field('a')}
      {field('b')}
      <StripDiagram draft={draft} setup={setup} />
      {field('length')}
    </div>
    <div className="pivot-measurement">
      <PivotDistanceDiagram setup={setup} />
      {field('distance')}
    </div>
  </>;
}
