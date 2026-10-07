import { useState } from 'react';

export function UpdateNotice({ onUpdate }: { onUpdate: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <aside className="update-notice" aria-label="App update">
    <div className="update-notice-inner"><div><span className="eyebrow">UPDATE AVAILABLE</span><p role="status">{failed ? 'Couldn’t update just now. Try again.' : 'A new version is ready.'}</p></div>
      <button className="button update-button" disabled={busy} onClick={async () => { setBusy(true); setFailed(false); try { await onUpdate(); } catch { setBusy(false); setFailed(true); } }}>{busy ? 'Updating…' : 'Update app'}<span aria-hidden="true">↻</span></button>
    </div>
  </aside>;
}
