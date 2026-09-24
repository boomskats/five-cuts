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
    <div className="section-heading notebook-heading"><div><span className="eyebrow">03 / THE NOTEBOOK</span><h2 id="notebook-title">Every cut tells a story.</h2></div><button className="button" onClick={onNew}><span aria-hidden="true">＋</span> New session</button></div>
    <p className="section-description">{sessions.length} session{sessions.length === 1 ? '' : 's'} · Choose a session to see its tests.</p>
    <div className="session-list" aria-label="Saved sessions">{[...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(session => {
      const hasDraft = !!(session.draft.a || session.draft.b);
      return <div key={session.id} className={`session-item ${session.id === active.id ? 'active' : ''}`}>
        <button className="session-select" aria-pressed={session.id === active.id} aria-label={`Open session ${session.name || 'Untitled fence'}`} onClick={() => onSelect(session.id)}>
          <strong>{session.name || 'Untitled fence'}</strong>
          <small>{timestamp(session.createdAt)}</small>
          <span className="session-test-count">{session.trials.length ? `${session.trials.length} test${session.trials.length === 1 ? '' : 's'}` : hasDraft ? 'Draft · no tests recorded' : 'No tests yet'}</span>
          {session.id === active.id && <span className="session-current">✓ Viewing</span>}
        </button>
        <button className="text-button session-delete" aria-label={`Delete session ${session.name}`} onClick={() => onDelete(session)}>Delete</button>
      </div>;
    })}</div>
    <div className="notebook-controls">
      <div className="session-name"><label htmlFor="session-name">CURRENT SESSION</label><input id="session-name" maxLength={100} value={active.name} onChange={e => onRename(e.target.value)} onBlur={() => { if (!active.name.trim()) onRename('Untitled fence'); }} /><span>{timestamp(active.createdAt)}</span></div>
      <div className="notebook-backups"><button className="text-button" onClick={onExport}>Export notebook ↗</button><button className="text-button" onClick={onImport}>Restore backup ↙</button></div>
    </div>
  </>;
}
