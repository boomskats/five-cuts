import { parseDecimal } from './domain';
import type { MoveDirection, Unit } from './domain';

export function MoveField({ id, label, unit, amount, direction, suggested, onChange, onReset }: {
  id: string;
  label: string;
  unit: Unit;
  amount: string;
  direction: MoveDirection;
  suggested: boolean;
  onChange: (amount: string, direction: MoveDirection) => void;
  onReset: () => void;
}) {
  const invalid = amount !== '' && parseDecimal(amount) === null;
  return <div className="move-field">
    <label htmlFor={id}>{label} <span>({unit})</span></label>
    <div className={`move-inputs ${invalid ? 'invalid' : ''}`}>
      <input id={id} inputMode="decimal" autoComplete="off" placeholder="Not recorded" value={amount} aria-invalid={invalid} onChange={e => onChange(e.target.value, direction)} />
      <select aria-label={`${label}, direction`} value={direction} onChange={e => onChange(amount, e.target.value as MoveDirection)}><option value="away">Away from you</option><option value="toward">Toward you</option></select>
      <button type="button" className="icon-button reset-move" aria-label="Reset to suggested move" title="Reset to suggested move" disabled={suggested} onClick={onReset}>↺</button>
    </div>
    {invalid && <p className="move-error">Use a positive decimal, or leave it empty.</p>}
  </div>;
}
