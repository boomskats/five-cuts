import { useRef, useState } from 'react';

// Sleds keep their automatic name until someone names them; only those get the first-save prompt.
export const isDefaultSledName = (name: string) => /^(?:Sled|Setup) \d+$|^Untitled (?:sled|fence)$|^$/.test(name.trim());

function Pencil() {
  return <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 13.5 3.2 10.4 10.9 2.7a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2l-7.7 7.7ZM9.8 3.8l2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

export function SledName({ name, onRename, heading = false, id }: { name: string; onRename: (name: string) => void; heading?: boolean; id?: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const done = useRef(false);
  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    const next = value.trim();
    if (save && next && next !== name) onRename(next);
    setEditing(false);
  }
  if (editing) return <form className="sled-name" onSubmit={e => { e.preventDefault(); finish(true); }}>
    <input className="sled-name-input" aria-label="Sled name" autoFocus maxLength={100} value={value} onChange={e => setValue(e.target.value)} onBlur={() => finish(true)} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } }} />
  </form>;
  const Text = heading ? 'h3' : 'p';
  return <div className="sled-name">
    <Text id={id} className="sled-name-text">{name}</Text>
    <button type="button" className="rename-button" aria-label={`Rename ${name}`} title="Rename" onClick={() => { done.current = false; setValue(name); setEditing(true); }}><Pencil /></button>
  </div>;
}
