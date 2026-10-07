import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AdjustmentDiagram, BenchDiagram, Mark, SetupThumb } from './Illustrations';
import { Measurements } from './Measurements';
import { History } from './History';
import { SessionShelf } from './SessionShelf';
import { Equations } from './Equations';
import { UpdateNotice } from './UpdateNotice';
import { activateAppUpdate } from './app-update';
import { calculate, convertDraft, createNotebook, createSession, format, formatInput, fromMM, readMeasurements, rotation, setDraftField } from './domain';
import type { Draft, Notebook, Session, Setup, Unit } from './domain';
import { downloadJSON, isNotebook, loadNotebook, saveNotebook, STORAGE_KEY } from './storage';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const setupChoices = [
  { key: 'board', title: 'Board side of blade', values: ['left', 'right'], labels: ['Board on left', 'Board on right'] },
  { key: 'fence', title: 'Edge against fence', values: ['near', 'far'], labels: ['Near edge', 'Far edge'] },
  { key: 'pivot', title: 'End that stays fixed', values: ['left', 'right'], labels: ['Left end', 'Right end'] },
] as const;

function App() {
  const [initial] = useState(() => {
    try { return loadNotebook(localStorage); }
    catch { return { notebook: createNotebook(), error: 'This browser cannot save your work. Export a backup before leaving.', raw: null }; }
  });
  const [notebook, setNotebook] = useState<Notebook>(() => ({ ...initial.notebook, sessions: initial.notebook.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, initial.notebook.unit) })) }));
  const [blocked, setBlocked] = useState(!!initial.error);
  const [storageError, setStorageError] = useState(initial.error);
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(1);
  const [offlineAvailable, setOfflineAvailable] = useState(!!navigator.serviceWorker?.controller);
  const [offlineError, setOfflineError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [standalone] = useState(() => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
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
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installed = () => { setInstallPrompt(null); setNotice('Installed. Open Five Cuts from your apps.'); installDialog.current?.close(); };
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', installed);
    return () => {
      mounted = false;
      window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installed);
    };
  }, []);

  function updateSession(update: (s: Session) => Session) {
    setNotebook(n => ({ ...n, sessions: n.sessions.map(s => s.id === n.activeId ? { ...update(s), updatedAt: new Date().toISOString() } : s) }));
  }
  function changeUnit(next: Unit) {
    setNotebook(n => ({ ...n, unit: next, sessions: n.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, next) })) }));
  }
  function startSetup(setup: Setup, scroll = false) {
    setNotebook(n => {
      const previous = n.sessions.find(s => s.id === n.activeId)!;
      const session = createSession(n.unit, setup, n.sessions.length + 1);
      session.draft.distance = previous.draft.distance;
      if (previous.draft.exactMM?.distance) session.draft.exactMM = { distance: previous.draft.exactMM.distance };
      return { ...n, activeId: session.id, sessions: [...n.sessions, session] };
    });
    setStep(1); setNotice('New setup started.');
    if (scroll) document.getElementById('setup')?.scrollIntoView({ behavior: 'smooth' });
  }
  function newSession() { startSetup(active.setup, true); }
  function changeSetup<K extends keyof Setup>(key: K, value: Setup[K]) {
    if (active.setup[key] === value) return;
    const setup = { ...active.setup, [key]: value };
    if (active.trials.length) startSetup(setup);
    else { updateSession(s => ({ ...s, setup })); setStep(1); }
  }
  function deleteSession(session: Session) {
    if (!window.confirm(`Delete “${session.name}” and its ${session.trials.length} test(s)? You cannot undo this.`)) return;
    setNotebook(n => {
      let sessions = n.sessions.filter(s => s.id !== session.id);
      if (!sessions.length) sessions = [createSession(n.unit)];
      return { ...n, sessions, activeId: n.activeId === session.id ? sessions.at(-1)!.id : n.activeId };
    });
    setStep(1); setNotice('Setup deleted.');
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Backup is too large (maximum 10 MB).');
      const parsed: unknown = JSON.parse(await file.text());
      if (!isNotebook(parsed)) throw new Error('This file is not a supported Five Cuts notebook.');
      if (!window.confirm('Restore this backup? It will replace every session on this device. Export the current notebook first if you want to keep it.')) return;
      setNotebook({ ...parsed, sessions: parsed.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, parsed.unit) })) }); setBlocked(false); setStep(1); setNotice('Notebook restored.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read the backup.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  }
  function recordTest() {
    if (!measurements) return;
    updateSession(s => ({ ...s, trials: [...s.trials, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), setup: { ...s.setup }, measurements, actualMove: calculate(measurements, s.setup).move }], draft: { ...s.draft, a: '', b: '' } }));
    setStep(5); setNotice(`Test ${active.trials.length + 1} saved.`);
  }

  return <>
    <a className="skip-link" href="#calculator">Skip to measurements</a>
    {needRefresh && <UpdateNotice onUpdate={activateAppUpdate} />}
    <header className="site-header">
      <h1 className="brand"><Mark />FIVE CUTS</h1>
      <div className="header-actions"><div className="unit-toggle" role="group" aria-label="Measurement units"><button aria-pressed={unit === 'mm'} onClick={() => changeUnit('mm')}>mm</button><button aria-pressed={unit === 'in'} onClick={() => changeUnit('in')}>in</button></div>{!standalone && <button className="text-button install-button" onClick={() => installDialog.current?.showModal()}>Install app</button>}</div>
    </header>
    <main>
      {storageError && <div className="banner error" role="alert"><p>{storageError}</p><div className="inline-actions"><button className="text-button" onClick={() => downloadJSON(notebook, 'five-cuts-unsaved-notebook.json')}>Export current work</button>{initial.raw !== null && blocked && <button className="text-button" onClick={() => downloadJSON(initial.raw, 'five-cuts-recovery.json')}>Download original data</button>}{blocked && <button className="text-button" onClick={() => { if (confirm('Replace unreadable saved data with this current notebook? Download the original data first if needed.')) { try { localStorage.removeItem(STORAGE_KEY); setBlocked(false); } catch { setNotice('Storage is still unavailable. Export your work instead.'); } } }}>Reset local storage</button>}</div></div>}
      {(notice || storageError) && <div className="notice" role="status">{notice || 'Saving is off. Export your work before leaving.'}</div>}
      <div className="workspace">
        <section className="setup-section" id="setup" aria-labelledby="setup-title">
          <div className="section-heading"><h2 id="setup-title">Your saw</h2>{active.trials.length > 0 && <button className="button primary new-setup-button" onClick={newSession}>＋ New setup</button>}</div>
          <div className="setup-choices">{setupChoices.map(group => <fieldset key={group.key}><legend>{group.title}</legend><div className="choice-pair">{group.values.map((value, index) => <button key={value} type="button" aria-pressed={active.setup[group.key] === value} onClick={() => changeSetup(group.key, value)}><SetupThumb setup={{ ...active.setup, [group.key]: value }} emphasis={group.key} /><span>{group.labels[index]}</span></button>)}</div></fieldset>)}</div>
          <div className="bench"><BenchDiagram key={active.id} setup={active.setup} step={step} /><div className="cut-steps" role="group" aria-label="Cut instructions">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-pressed={step === n} onClick={() => setStep(n)}><span>{n}</span><small>{n === 1 ? 'Start' : n === 5 ? 'Strip' : 'Rotate'}</small></button>)}</div>
            <div className="step-instruction" aria-live="polite"><h3>{step === 1 ? '1. Cut the first edge' : step === 5 ? '5. Cut the measuring strip' : `${step}. Turn ${rotation(active.setup)}`}</h3><p>{step === 1 ? 'Start with a flat, roughly square panel supported by your sled or mitre gauge. Mark the top “up”. Put any edge against the fence; trim and mark the blade-side edge 1.' : step === 5 ? `Keep the marked face up. Turn ${rotation(active.setup)} and put edge 4 against the fence. Cut a strip from edge 1. Mark its far end A (first through the blade) and near end B.` : `Keep the marked face up. Turn a quarter turn and put edge ${step - 1} against the fence. Trim the blade-side edge; mark it ${step}.`}</p><div className="step-nav"><button className="text-button" disabled={step === 1} onClick={() => setStep(s => s - 1)}>← Previous</button><button className="text-button" disabled={step === 5} onClick={() => setStep(s => s + 1)}>Next cut →</button></div></div>
          </div>
        </section>
        <section className="calculator" id="calculator" aria-labelledby="calculator-title">
          <div className="section-heading"><h2 id="calculator-title">Measure the strip</h2></div>
          <form id="measurement-form" onSubmit={e => { e.preventDefault(); recordTest(); }} noValidate>
            <Measurements draft={draft} unit={unit} setup={active.setup} onChange={(key, value) => updateSession(s => ({ ...s, draft: setDraftField(s.draft, key, value) }))} />
            {badGeometry && <p className="validation" role="alert">Check the numbers. A and B must be smaller than L; their difference cannot exceed 10% of L.</p>}
          </form>
          <div className={`result ${result ? 'has-result' : ''}`}>
            <span className="eyebrow">{measurements ? 'Suggested fence move' : latest ? `Last saved test · ${active.trials.length}` : 'Fence move'}</span>
            {!result ? <div className="result-empty"><p>Enter A, B, L, and D to see the fence move.</p></div> : <>
              <div aria-live="polite"><h3 className="move-amount">{format(Math.abs(result.move), unit)} <span>{unit}</span></h3><p className="move-direction">{result.direction === 'none' ? 'No fence move needed.' : <>Move the <strong>{resultSetup.pivot === 'left' ? 'right' : 'left'} adjustment point</strong><br /><strong>{result.direction === 'away' ? 'away from you ↑' : 'toward you ↓'}</strong></>}</p></div>
              <AdjustmentDiagram setup={resultSetup} move={result.move} />
              <p className="result-advice">{result.direction === 'none' ? 'A and B match.' : `Measure it at D, ${formatInput(fromMM(resultMeasurements!.distance, unit), unit)} ${unit} from the pivot. Tighten and test again.`}</p>
            </>}
          </div>
          <button className="button primary record-button" type="submit" form="measurement-form" disabled={!measurements}>Record test {active.trials.length + 1}</button>
          <details className="method-details"><summary>How it works <span aria-hidden="true">＋</span></summary><div>{result && <dl className="result-stats"><div><dt>Strip taper · A − B</dt><dd>{format(result.taper, unit, true)} {unit}</dd></div><div><dt>Fence angle error</dt><dd>{Math.abs(result.errorDegrees).toFixed(5)}°</dd></div></dl>}<p>Four quarter-turns build the fence error into the strip four times over.</p><Equations /></div></details>
        </section>
      </div>
      <section className="notebook" id="notebook" aria-labelledby="notebook-title">
        <SessionShelf sessions={notebook.sessions} active={active} onSelect={id => { setNotebook(n => ({ ...n, activeId: id })); setStep(1); setNotice('Setup opened.'); }} onNew={newSession} onRename={name => updateSession(s => ({ ...s, name }))} onDelete={deleteSession} onExport={() => downloadJSON(notebook, `five-cuts-${new Date().toISOString().slice(0, 10)}.json`)} onImport={() => importInput.current?.click()} />
        <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e => void importBackup(e.target.files?.[0])} />
      <History key={active.id} trials={active.trials} unit={unit} onMove={(id, move) => { updateSession(s => ({ ...s, trials: s.trials.map(t => t.id === id ? { ...t, actualMove: move } : t) })); setNotice('Actual adjustment saved.'); }} onDelete={id => { if (confirm('Delete this test and its saved move? You cannot undo this.')) { updateSession(s => ({ ...s, trials: s.trials.filter(t => t.id !== id) })); setNotice('Test deleted.'); } }} />
      </section>
    </main>
    <nav className="mobile-nav" aria-label="Workshop navigation"><a href="#setup">Saw</a><a href="#calculator">Measure</a><a href="#notebook">Notebook</a></nav>
    <dialog ref={installDialog} className="install-dialog" aria-labelledby="install-title"><div className="dialog-header"><h2 id="install-title">Install Five Cuts</h2><button className="icon-button" aria-label="Close installation help" onClick={() => installDialog.current?.close()}>×</button></div><p>Works offline. Your notebook stays on this device.</p><p className="connection"><i />{offlineError ? 'Offline setup failed. Reload while online.' : (offlineReady || offlineAvailable) ? 'Offline ready' : 'Getting ready for offline use…'}</p>{installPrompt ? <button className="button primary" onClick={async () => { try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } catch { setNotice('Use your browser menu to install Five Cuts.'); } }}>Install</button> : <><h3>iPhone & iPad</h3><p>In Safari, tap Share, then Add to Home Screen.</p><h3>Android & desktop</h3><p>In your browser menu, choose Install app or Add to Home Screen.</p></>}<p className="version">v0.1</p></dialog>
  </>;
}
export default App;
