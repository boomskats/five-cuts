import { useState } from 'react';
import { timestamp } from './History';
import { Pencil, SledNameInput } from './SledName';
import type { Session } from './domain';

export function SessionShelf({ sessions, active, onSelect, onNew, onRename, onDelete }: {
  sessions: Session[];
  active: Session;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (name: string) => void;
  onDelete: (session: Session) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  return <>
    <div className="section-heading notebook-heading"><h2 id="history-title">History</h2><button className="button primary" onClick={onNew}><span aria-hidden="true">＋</span> New sled</button></div>
    <div className="session-list" aria-label="Saved sleds">{[...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(session => {
      const hasDraft = !!(session.draft.a || session.draft.b);
      const current = session.id === active.id;
      const editing = current && renaming;
      return <div key={session.id} className={`session-item ${current ? 'active' : ''}`}>
        {editing && <SledNameInput name={session.name} onDone={name => { if (name) onRename(name); setRenaming(false); }} />}
        <button className="session-select" aria-pressed={current} aria-label={`Open sled ${session.name || 'Untitled sled'}`} onClick={() => { setRenaming(false); onSelect(session.id); }}>
          {!editing && <strong>{session.name || 'Untitled sled'}</strong>}
          <small>{timestamp(session.createdAt)}</small>
          <span className="session-test-count">{session.trials.length ? `${session.trials.length} test${session.trials.length === 1 ? '' : 's'}` : hasDraft ? 'Draft' : 'No tests'}</span>
        </button>
        {current && !editing && <button type="button" className="rename-button" aria-label={`Rename ${session.name}`} title="Rename" onClick={() => setRenaming(true)}><Pencil /></button>}
        <button className="text-button session-delete" aria-label={`Delete sled ${session.name}`} onClick={() => onDelete(session)}>Delete</button>
      </div>;
    })}</div>
  </>;
}
