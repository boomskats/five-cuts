import { timestamp } from './History';
import type { Session } from './domain';

export function SessionShelf({ sessions, active, onSelect, onNew, onRename, onDelete, onExport, onImport }: {
  sessions: Session[];
  active: Session;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (name: string) => void;
  onDelete: (session: Session) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return <>
    <div className="section-heading notebook-heading"><h2 id="history-title">History</h2><button className="button primary" onClick={onNew}><span aria-hidden="true">＋</span> New sled</button></div>
    <div className="session-list" aria-label="Saved sleds">{[...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(session => {
      const hasDraft = !!(session.draft.a || session.draft.b);
      return <div key={session.id} className={`session-item ${session.id === active.id ? 'active' : ''}`}>
        <button className="session-select" aria-pressed={session.id === active.id} aria-label={`Open sled ${session.name || 'Untitled sled'}`} onClick={() => onSelect(session.id)}>
          <strong>{session.name || 'Untitled sled'}</strong>
          <small>{timestamp(session.createdAt)}</small>
          <span className="session-test-count">{session.trials.length ? `${session.trials.length} test${session.trials.length === 1 ? '' : 's'}` : hasDraft ? 'Draft' : 'No tests'}</span>
        </button>
        <button className="text-button session-delete" aria-label={`Delete sled ${session.name}`} onClick={() => onDelete(session)}>Delete</button>
      </div>;
    })}</div>
    <div className="notebook-controls">
      <div className="session-name"><label htmlFor="session-name">Sled name</label><input id="session-name" maxLength={100} value={active.name} onChange={e => onRename(e.target.value)} onBlur={() => { if (!active.name.trim()) onRename('Untitled sled'); }} /></div>
      <div className="notebook-backups"><button className="text-button" onClick={onExport}>Export backup</button><button className="text-button" onClick={onImport}>Restore backup</button></div>
    </div>
  </>;
}
