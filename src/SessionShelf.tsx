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
    <div className="section-heading notebook-heading"><h2 id="notebook-title">Notebook</h2><button className="button primary" onClick={onNew}><span aria-hidden="true">＋</span> New setup</button></div>
    <div className="session-list" aria-label="Saved setups">{[...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(session => {
      const hasDraft = !!(session.draft.a || session.draft.b);
      return <div key={session.id} className={`session-item ${session.id === active.id ? 'active' : ''}`}>
        <button className="session-select" aria-pressed={session.id === active.id} aria-label={`Open setup ${session.name || 'Untitled fence'}`} onClick={() => onSelect(session.id)}>
          <strong>{session.name || 'Untitled fence'}</strong>
          <small>{timestamp(session.createdAt)}</small>
          <span className="session-test-count">{session.trials.length ? `${session.trials.length} test${session.trials.length === 1 ? '' : 's'}` : hasDraft ? 'Draft' : 'No tests'}</span>
        </button>
        <button className="text-button session-delete" aria-label={`Delete setup ${session.name}`} onClick={() => onDelete(session)}>Delete</button>
      </div>;
    })}</div>
    <div className="notebook-controls">
      <div className="session-name"><label htmlFor="session-name">Setup name</label><input id="session-name" maxLength={100} value={active.name} onChange={e => onRename(e.target.value)} onBlur={() => { if (!active.name.trim()) onRename('Untitled fence'); }} /></div>
      <div className="notebook-backups"><button className="text-button" onClick={onExport}>Export notebook</button><button className="text-button" onClick={onImport}>Restore backup</button></div>
    </div>
  </>;
}
