import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AdjustmentDiagram, BenchDiagram, Mark, SetupThumb } from './Illustrations';
import { Measurements } from './Measurements';
import { History } from './History';
import { SessionShelf } from './SessionShelf';
import { Equations } from './Equations';
import { UpdateNotice } from './UpdateNotice';
import { activateAppUpdate } from './app-update';
import { calculate, convertDraft, createNotebook, createSession, format, readMeasurements, rotation, setDraftField } from './domain';
import type { Draft, Notebook, Session, Setup, Unit } from './domain';
import { downloadJSON, isNotebook, loadNotebook, saveNotebook, STORAGE_KEY } from './storage';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const setupChoices = [
  { key: 'board', title: 'Board beside blade', values: ['left', 'right'], labels: ['Board on left', 'Board on right'] },
  { key: 'fence', title: 'Fence against board', values: ['near', 'far'], labels: ['Near edge', 'Far edge'] },
  { key: 'pivot', title: 'Fixed pivot', values: ['left', 'right'], labels: ['Left end', 'Right end'] },
] as const;

function App() {
  const [initial] = useState(() => {
    try { return loadNotebook(localStorage); }
    catch { return { notebook: createNotebook(), error: 'Local storage is unavailable. Your work cannot be saved in this browser.', raw: null }; }
  });
  const [notebook, setNotebook] = useState<Notebook>(() => ({ ...initial.notebook, sessions: initial.notebook.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, initial.notebook.unit) })) }));
  const [blocked, setBlocked] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error);
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(1);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineAvailable, setOfflineAvailable] = useState(!!navigator.serviceWorker?.controller);
  const [offlineError, setOfflineError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const installDialog = useRef<HTMLDialogElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const { offlineReady: [offlineReady], needRefresh: [needRefresh] } = useRegisterSW({ onRegisterError: () => setOfflineError(true), onNeedReload: () => {} });
  const active = notebook.sessions.find(s => s.id === notebook.activeId)!;
  const unit = notebook.unit;
  const draft = active.draft;
  const measurements = readMeasurements(draft);
  const latest = active.trials.at(-1);
  const result = measurements ? calculate(measurements, active.setup) : latest ? calculate(latest.measurements, latest.setup) : null;
  const resultMeasurements = measurements ?? latest?.measurements;
  const resultSetup = measurements ? active.setup : latest?.setup ?? active.setup;
  const complete = ['a', 'b', 'length', 'distance'].every(key => draft[key as keyof Draft] !== '');
  const badGeometry = complete && !measurements;

  useEffect(() => {
    if (!blocked) setStorageError(saveNotebook(localStorage, notebook));
  }, [notebook, blocked]);
  useEffect(() => {
    let mounted = true;
    void navigator.serviceWorker?.ready.then(() => { if (mounted) setOfflineAvailable(true); });
    const connected = () => setOnline(navigator.onLine);
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installed = () => { setInstallPrompt(null); setNotice('Five Cuts is installed. Find it with your other apps.'); installDialog.current?.close(); };
    window.addEventListener('online', connected); window.addEventListener('offline', connected);
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', installed);
    return () => {
      mounted = false;
      window.removeEventListener('online', connected); window.removeEventListener('offline', connected);
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installed);
    };
  }, []);

  function updateSession(update: (s: Session) => Session) {
    setNotebook(n => ({ ...n, sessions: n.sessions.map(s => s.id === n.activeId ? { ...update(s), updatedAt: new Date().toISOString() } : s) }));
  }
  function changeUnit(next: Unit) {
    setNotebook(n => ({ ...n, unit: next, sessions: n.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, next) })) }));
  }
  function newSession() {
    const session = createSession(unit, active.setup, notebook.sessions.length + 1);
    session.draft.distance = active.draft.distance;
    if (active.draft.exactMM?.distance) session.draft.exactMM = { distance: active.draft.exactMM.distance };
    setNotebook(n => ({ ...n, activeId: session.id, sessions: [...n.sessions, session] }));
    setStep(1); setNotice('New session started.');
    document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' });
  }
  function deleteSession(session: Session) {
    if (!window.confirm(`Delete “${session.name}” and its ${session.trials.length} test(s)? This cannot be undone.`)) return;
    setNotebook(n => {
      let sessions = n.sessions.filter(s => s.id !== session.id);
      if (!sessions.length) sessions = [createSession(n.unit)];
      return { ...n, sessions, activeId: n.activeId === session.id ? sessions.at(-1)!.id : n.activeId };
    });
    setStep(1); setNotice('Session deleted.');
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Backup is too large (maximum 10 MB).');
      const parsed: unknown = JSON.parse(await file.text());
      if (!isNotebook(parsed)) throw new Error('This file is not a supported Five Cuts notebook.');
      if (!window.confirm('Replace this browser’s entire notebook with the backup? Export your current notebook first if you want to keep it.')) return;
      setNotebook({ ...parsed, sessions: parsed.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, parsed.unit) })) }); setBlocked(false); setStep(1); setNotice('Notebook restored.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read the backup.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  }
  function recordTest() {
    if (!measurements) return;
    updateSession(s => ({ ...s, trials: [...s.trials, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), setup: { ...s.setup }, measurements, actualMove: calculate(measurements, s.setup).move }], draft: { ...s.draft, a: '', b: '' } }));
    setStep(5); setNotice(`Test ${active.trials.length + 1} saved with the suggested adjustment.`);
  }

  return <>
    <a className="skip-link" href="#calculator">Skip to measurements</a>
    {needRefresh && <UpdateNotice onUpdate={activateAppUpdate} />}
    <header className="site-header">
      <a className="brand" href="#" aria-label="Five Cuts home"><Mark /><span>FIVE CUTS<small>A WORKSHOP INSTRUMENT</small></span></a>
      <div className="header-actions"><span className="connection"><i />{!online ? 'Offline' : (offlineReady || offlineAvailable) ? 'Offline ready' : offlineError ? 'Online only' : 'On the bench'}</span><button className="text-button install-button" onClick={() => installDialog.current?.showModal()}>Install app <span aria-hidden="true">↗</span></button></div>
    </header>
    <main>
      <section className="intro"><div><span className="eyebrow">PRECISION, ONE SMALL ADJUSTMENT AT A TIME</span><h1>Five cuts.<br /><em>One square fence.</em></h1></div><div className="intro-aside"><span className="instrument-number">No. 05</span><p>Measure the error. Make the move.<br />A quieter way to dial in your crosscut fence.</p></div></section>
      {storageError && <div className="banner error" role="alert"><p>{storageError}</p><div className="inline-actions"><button className="text-button" onClick={() => downloadJSON(notebook, 'five-cuts-unsaved-notebook.json')}>Export current work</button>{initial.raw !== null && blocked && <button className="text-button" onClick={() => downloadJSON(initial.raw, 'five-cuts-recovery.json')}>Download original data</button>}{blocked && <button className="text-button" onClick={() => { if (confirm('Replace unreadable saved data with this current notebook? Download the original data first if needed.')) { try { localStorage.removeItem(STORAGE_KEY); setBlocked(false); } catch { setNotice('Storage is still unavailable. Export your work instead.'); } } }}>Reset local storage</button>}</div></div>}
      <div className="bench-controls"><div className="unit-control"><span className="eyebrow">MEASURE IN</span><div className="unit-toggle" role="group" aria-label="Measurement units"><button aria-pressed={unit === 'mm'} onClick={() => changeUnit('mm')}>mm</button><button aria-pressed={unit === 'in'} onClick={() => changeUnit('in')}>in</button></div></div><a className="text-button notebook-link" href="#notebook">Notebook <span className="badge">{notebook.sessions.length} session{notebook.sessions.length === 1 ? '' : 's'}</span><span aria-hidden="true">↓</span></a></div>
      <div className="notice" role="status">{notice || 'Saved on this device. No account, no cloud, no distractions.'}</div>
      <div className="workspace">
        <section className="setup-section" id="setup" aria-labelledby="setup-title">
          <div className="section-heading"><div><span className="eyebrow">01 / KNOW YOUR SETUP</span><h2 id="setup-title">From where you stand.</h2></div><span className="small-note">All views from above</span></div>
          <p className="section-description">Stand at the infeed side, looking along the cut. Match the board, fence and fixed pivot to your saw.</p>
          <div className="setup-choices">{setupChoices.map(group => <fieldset key={group.key} disabled={active.trials.length > 0}><legend>{group.title}</legend><div className="choice-pair">{group.values.map((value, index) => <button key={value} type="button" aria-pressed={active.setup[group.key] === value} onClick={() => { updateSession(s => ({ ...s, setup: { ...s.setup, [group.key]: value } as Setup })); setStep(1); }}><SetupThumb setup={{ ...active.setup, [group.key]: value }} emphasis={group.key} /><span>{group.labels[index]}</span></button>)}</div></fieldset>)}</div>
          {active.trials.length > 0 && <p className="locked-note">Setup locked to keep this session consistent. <button className="text-button" onClick={newSession}>New setup? Start a session ↗</button></p>}
          <div className="bench"><div className="bench-topline"><span className="eyebrow">THE FIVE-CUT METHOD</span><span>0{step} / 05</span></div><BenchDiagram setup={active.setup} step={step} /><div className="cut-steps" role="group" aria-label="Cut instructions">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-pressed={step === n} onClick={() => setStep(n)}><span>{n}</span><small>{n === 1 ? 'Start' : n === 5 ? 'Strip' : 'Rotate'}</small></button>)}</div>
            <div className="step-instruction" aria-live="polite"><h3>{step === 1 ? '01. Establish your first edge.' : step === 5 ? '05. Return to the first edge.' : `0${step}. Rotate ${rotation(active.setup)}.`}</h3><p>{step === 1 ? 'Use a flat, roughly square panel, comfortably supported by your sled or mitre gauge. Mark the face “up”. With one edge against the fence, trim the blade-side edge and label it 1.' : step === 5 ? `Rotate ${rotation(active.setup)} once more, putting edge 4 against the fence. Trim a narrow, measurable strip from edge 1. Mark its far end A and near end B before removing it.` : `Turn the panel ${rotation(active.setup)} a quarter turn, keeping the same face up. Put freshly cut edge ${step - 1} firmly against the fence. Trim the next edge and label it ${step}.`}</p><div className="step-nav"><button className="text-button" disabled={step === 1} onClick={() => setStep(s => s - 1)}>← Previous</button><button className="text-button" disabled={step === 5} onClick={() => setStep(s => s + 1)}>Next cut →</button></div></div>
          </div>
        </section>
        <section className="calculator" id="calculator" aria-labelledby="calculator-title">
          <div className="section-heading"><div><span className="eyebrow">02 / MEASURE & REFINE</span><h2 id="calculator-title">Read the fifth cut.</h2></div></div>
          <p className="section-description">Your strip, as it came off the saw. Measure A and B with calipers.</p>
          <form onSubmit={e => { e.preventDefault(); recordTest(); }} noValidate>
            <Measurements draft={draft} unit={unit} setup={active.setup} onChange={(key, value) => updateSession(s => ({ ...s, draft: setDraftField(s.draft, key, value) }))} />
            {badGeometry && <p className="validation" role="alert">Check all four values. Widths must be smaller than L, and |A − B| must be no more than 10% of L. Check decimal units and the A/B labels.</p>}
            <button className="button primary record-button" type="submit" disabled={!measurements}>Record test {active.trials.length + 1}<span aria-hidden="true">↗</span></button>
            <p className="form-footnote">Saves the suggested adjustment too. Edit it in the notebook.</p>
          </form>
          <div className={`result ${result ? 'has-result' : ''}`}>
            <span className="eyebrow">{measurements ? 'YOUR NEXT ADJUSTMENT · LIVE PREVIEW' : latest ? `LAST RECORDED · TEST ${active.trials.length}` : 'A MEASURED APPROACH'}</span>
            {!result ? <div className="result-empty"><Mark small /><h3>Small moves.<br />Better cuts.</h3><p>Your adjustment will appear here once all four measurements are entered.</p></div> : <>
              <div aria-live="polite"><h3 className="move-amount">{format(Math.abs(result.move), unit)} <span>{unit}</span></h3><p className="move-direction">{result.direction === 'none' ? 'No adjustment indicated.' : <>Move the <strong>{resultSetup.pivot === 'left' ? 'right' : 'left'} adjustment point</strong><br /><strong>{result.direction === 'away' ? 'away from you ↑' : 'toward you ↓'}</strong></>}</p></div>
              <AdjustmentDiagram setup={resultSetup} move={result.move} />
              <dl className="result-stats"><div><dt>Strip taper · A − B</dt><dd>{format(result.taper, unit, true)} {unit}</dd></div><div><dt>Fence angle error</dt><dd>{Math.abs(result.errorDegrees).toFixed(5)}°</dd></div></dl>
              <p className="result-advice">{result.direction === 'none' ? 'A and B match. No move needed.' : `Keep the ${resultSetup.pivot} pivot fixed. Move at D = ${format(resultMeasurements!.distance, unit)} ${unit}. Retighten and repeat.`}</p>
            </>}
          </div>
          <details className="method-details"><summary>The arithmetic, not the magic <span aria-hidden="true">＋</span></summary><div><p>Four rotations amplify the fence’s angular error fourfold. With A at the far end and B at the near end:</p><Equations /><p>The signs are mirrored for a left-side blade and for a right-side pivot. A positive move means away from you. The fence’s near/far position changes the required panel rotation, not the correction sign.</p><p>D is the distance along the fence to your adjustment point. L is the span between measuring locations in the feed direction.</p></div></details>
        </section>
      </div>
      <section className="notebook" id="notebook" aria-labelledby="notebook-title">
        <SessionShelf sessions={notebook.sessions} active={active} onSelect={id => { setNotebook(n => ({ ...n, activeId: id })); setStep(1); setNotice('Session opened.'); }} onNew={newSession} onRename={name => updateSession(s => ({ ...s, name }))} onDelete={deleteSession} onExport={() => downloadJSON(notebook, `five-cuts-${new Date().toISOString().slice(0, 10)}.json`)} onImport={() => importInput.current?.click()} />
        <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e => void importBackup(e.target.files?.[0])} />
      <History key={active.id} sessionName={active.name} trials={active.trials} unit={unit} onMove={(id, move) => { updateSession(s => ({ ...s, trials: s.trials.map(t => t.id === id ? { ...t, actualMove: move } : t) })); setNotice('Actual adjustment saved.'); }} onDelete={id => { if (confirm('Delete this test and its adjustment? This cannot be undone.')) { updateSession(s => ({ ...s, trials: s.trials.filter(t => t.id !== id) })); setNotice('Test deleted.'); } }} />
      </section>
      <footer className="site-footer"><div><Mark small /><span>FIVE CUTS <small>Measure. Adjust. Repeat.</small></span></div><p>Your workshop notebook.<br />Saved on this device.</p><span className="version">v0.1 · Made for the workshop</span></footer>
    </main>
    <nav className="mobile-nav" aria-label="Workshop navigation"><a href="#setup"><span>01</span> Setup</a><a href="#calculator"><span>02</span> Measure</a><a href="#notebook"><span>03</span> Notebook</a></nav>
    <dialog ref={installDialog} className="install-dialog" aria-labelledby="install-title"><div className="dialog-header"><div><span className="eyebrow">TAKE IT TO THE WORKSHOP</span><h2 id="install-title">A place on your home screen.</h2></div><button className="icon-button" aria-label="Close installation help" onClick={() => installDialog.current?.close()}>×</button></div><p>Install Five Cuts for a standalone window and offline use. No account needed.</p>{offlineError && <p role="alert">Offline setup did not complete. Check your connection and browser permissions, then reload while online.</p>}{installPrompt ? <button className="button primary" onClick={async () => { try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } catch { setNotice('Use your browser menu to install Five Cuts.'); } }}>Install Five Cuts ↗</button> : <><h3>iPhone & iPad</h3><p>In Safari, choose Share → Add to Home Screen → Add.</p><h3>Android & desktop</h3><p>Use your browser’s menu and choose Install app or Add to Home Screen. If you already installed it, open Five Cuts from your apps.</p></>}<p className="small-note">Once you see “Offline ready”, you’re ready for the workshop—with or without a connection.</p></dialog>
  </>;
}
export default App;
