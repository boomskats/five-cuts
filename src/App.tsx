import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AdjustmentDiagram, BenchDiagram, Mark, SetupThumb } from './Illustrations';
import { Measurements } from './Measurements';
import { History } from './History';
import { SessionShelf } from './SessionShelf';
import { Equations } from './Equations';
import { UpdateNotice } from './UpdateNotice';
import { activateAppUpdate } from './app-update';
import { MoveField } from './MoveField';
import { isDefaultSledName } from './SledName';
import { calculate, convertDraft, createNotebook, createSession, format, formatInput, fromMM, parseDecimal, readMeasurements, rotation, setDraftField, toMM } from './domain';
import type { Draft, MoveDirection, Notebook, Session, Setup, Unit } from './domain';
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
  const [notice, setNoticeState] = useState({ text: '', key: 0, shown: false });
  const [step, setStep] = useState(1);
  const [savedTest, setSavedTest] = useState<number | null>(null);
  const [naming, setNaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [offlineAvailable, setOfflineAvailable] = useState(!!navigator.serviceWorker?.controller);
  const [offlineError, setOfflineError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [standalone] = useState(() => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const installDialog = useRef<HTMLDialogElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const savedStatus = useRef<HTMLParagraphElement>(null);
  const { offlineReady: [offlineReady], needRefresh: [needRefresh] } = useRegisterSW({ onRegisterError: () => setOfflineError(true), onNeedReload: () => {} });
  const active = notebook.sessions.find(s => s.id === notebook.activeId)!;
  const unit = notebook.unit;
  const draft = active.draft;
  const measurements = readMeasurements(draft);
  const result = measurements ? calculate(measurements, active.setup) : null;
  const complete = ['a', 'b', 'length', 'distance'].every(key => draft[key as keyof Draft] !== '');
  const badGeometry = complete && !measurements;
  const suggestedAmount = result ? formatInput(Math.abs(fromMM(result.move, unit)), unit) : '';
  const suggestedDirection: MoveDirection = result && result.move < 0 ? 'toward' : 'away';
  const moveAmount = draft.move?.amount ?? suggestedAmount;
  const moveDirection = draft.move?.direction ?? suggestedDirection;
  const parsedMove = parseDecimal(moveAmount);
  const moveInvalid = moveAmount !== '' && parsedMove === null;

  useEffect(() => {
    if (!blocked) setStorageError(saveNotebook(localStorage, notebook));
  }, [notebook, blocked]);
  useEffect(() => {
    // Saving removes the button that had focus and collapses the step; keep the confirmation in view.
    if (!savedTest || naming) return;
    savedStatus.current?.scrollIntoView({ block: 'center' });
    savedStatus.current?.focus({ preventScroll: true });
  }, [savedTest, naming]);
  useEffect(() => {
    if (!notice.shown) return;
    const hide = setTimeout(() => setNoticeState(n => n.key === notice.key ? { ...n, shown: false } : n), 4500);
    const clear = setTimeout(() => setNoticeState(n => n.key === notice.key ? { ...n, text: '' } : n), 4800);
    return () => { clearTimeout(hide); clearTimeout(clear); };
  }, [notice.key, notice.shown]);
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

  function setNotice(text: string) { setNoticeState({ text, key: Date.now(), shown: !!text }); }
  function resetFlow() { setStep(1); setSavedTest(null); setNaming(null); }
  function updateSession(update: (s: Session) => Session) {
    setNotebook(n => ({ ...n, sessions: n.sessions.map(s => s.id === n.activeId ? { ...update(s), updatedAt: new Date().toISOString() } : s) }));
  }
  function changeUnit(next: Unit) {
    setNotebook(n => ({ ...n, unit: next, sessions: n.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, next) })) }));
  }
  function startSetup(setup: Setup, scroll = false, message = 'New sled started.') {
    setNotebook(n => {
      const previous = n.sessions.find(s => s.id === n.activeId)!;
      const session = createSession(n.unit, setup, n.sessions.length + 1);
      session.draft.distance = previous.draft.distance;
      if (previous.draft.exactMM?.distance) session.draft.exactMM = { distance: previous.draft.exactMM.distance };
      return { ...n, activeId: session.id, sessions: [...n.sessions, session] };
    });
    resetFlow(); setNotice(message);
    if (scroll) document.getElementById('sled')?.scrollIntoView({ behavior: 'smooth' });
  }
  function newSession() { startSetup(active.setup, true); }
  function changeSetup<K extends keyof Setup>(key: K, value: Setup[K]) {
    if (active.setup[key] === value) return;
    const setup = { ...active.setup, [key]: value };
    if (active.trials.length) startSetup(setup, false, 'New sled started. Earlier tests are in History.');
    else { updateSession(s => ({ ...s, setup })); setStep(1); }
  }
  function deleteSession(session: Session) {
    if (!window.confirm(`Delete “${session.name}” and its ${session.trials.length} test(s)? You cannot undo this.`)) return;
    setNotebook(n => {
      let sessions = n.sessions.filter(s => s.id !== session.id);
      if (!sessions.length) sessions = [createSession(n.unit)];
      return { ...n, sessions, activeId: n.activeId === session.id ? sessions.at(-1)!.id : n.activeId };
    });
    resetFlow(); setNotice('Sled deleted.');
  }
  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Backup is too large (maximum 10 MB).');
      const parsed: unknown = JSON.parse(await file.text());
      if (!isNotebook(parsed)) throw new Error('This file is not a supported Five Cuts backup.');
      if (!window.confirm('Restore this backup? It will replace every sled and test on this device. Export a backup first if you want to keep them.')) return;
      setNotebook({ ...parsed, sessions: parsed.sessions.map(s => ({ ...s, draft: convertDraft(s.draft, parsed.unit) })) }); setBlocked(false); resetFlow(); setNotice('Backup restored.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read the backup.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  }
  function saveTest() {
    if (!measurements || !result || moveInvalid) return;
    // An untouched move field records the exact suggestion, not its rounded display.
    const actualMove = result.direction === 'none' || !draft.move ? result.move : parsedMove === null ? null : toMM(parsedMove, unit) * (moveDirection === 'away' ? 1 : -1);
    updateSession(s => ({ ...s, trials: [...s.trials, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), setup: { ...s.setup }, measurements, actualMove }], draft: { ...s.draft, a: '', b: '', move: undefined } }));
    setStep(1); setSavedTest(active.trials.length + 1); setNotice('');
    // The first saved test is the moment a sled becomes worth naming.
    setNaming(!active.trials.length && isDefaultSledName(active.name) ? active.id : null); setNameDraft('');
  }
  function renameSled(name: string) { updateSession(s => ({ ...s, name })); }
  function nextField(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    const order = ['measure-a', 'measure-b', 'measure-length', 'measure-distance', 'actual-move'];
    const next = order[order.indexOf(event.target.id) + 1];
    if (next) document.getElementById(next)?.focus();
  }

  return <>
    <a className="skip-link" href="#measure">Skip to measurements</a>
    {needRefresh && <UpdateNotice onUpdate={activateAppUpdate} />}
    <header className="site-header">
      <h1 className="brand"><Mark />FIVE CUTS</h1>
      <div className="header-actions"><div className="unit-toggle" role="group" aria-label="Measurement units"><button aria-pressed={unit === 'mm'} onClick={() => changeUnit('mm')}>mm</button><button aria-pressed={unit === 'in'} onClick={() => changeUnit('in')}>in</button></div>{!standalone && <button className="text-button install-button" onClick={() => installDialog.current?.showModal()}>Install app</button>}</div>
    </header>
    <main>
      {storageError && <div className="banner error" role="alert"><p>{storageError}</p><div className="inline-actions"><button className="text-button" onClick={() => downloadJSON(notebook, 'five-cuts-unsaved.json')}>Export current work</button>{initial.raw !== null && blocked && <button className="text-button" onClick={() => downloadJSON(initial.raw, 'five-cuts-recovery.json')}>Download original data</button>}{blocked && <button className="text-button" onClick={() => { if (confirm('Replace unreadable saved data with your current work? Download the original data first if needed.')) { try { localStorage.removeItem(STORAGE_KEY); setBlocked(false); } catch { setNotice('Storage is still unavailable. Export your work instead.'); } } }}>Reset local storage</button>}</div></div>}
      <div className="workspace">
        <div className="workspace-column">
          <section className="setup-section" id="sled" aria-labelledby="sled-title">
            <div className="section-heading"><h2 id="sled-title">Configure your sled</h2></div>
            <div className="setup-choices">{setupChoices.map(group => <fieldset key={group.key}><legend>{group.title}</legend><div className="choice-pair">{group.values.map((value, index) => <button key={value} type="button" aria-pressed={active.setup[group.key] === value} onClick={() => changeSetup(group.key, value)}><SetupThumb setup={{ ...active.setup, [group.key]: value }} emphasis={group.key} /><span>{group.labels[index]}</span></button>)}</div></fieldset>)}</div>
          </section>
          <section className="cuts-section" id="cuts" aria-labelledby="cuts-title">
            <div className="section-heading"><h2 id="cuts-title">Make the cuts</h2></div>
            <div className="bench"><BenchDiagram key={active.id} setup={active.setup} step={step} /><div className="cut-steps" role="group" aria-label="Cut instructions">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-pressed={step === n} onClick={() => setStep(n)}><span>{n}</span><small>{n === 1 ? 'Start' : n === 5 ? 'Strip' : 'Rotate'}</small></button>)}</div>
              <div className="step-instruction" aria-live="polite"><h3>{step === 1 ? '1. Cut the first edge' : step === 5 ? '5. Cut the measuring strip' : `${step}. Turn ${rotation(active.setup)}`}</h3><p>{step === 1 ? 'Start with a flat, roughly square panel supported by your sled or mitre gauge. Mark the top “up”. Put any edge against the fence; trim and mark the blade-side edge 1.' : step === 5 ? `Keep the marked face up. Turn ${rotation(active.setup)} and put edge 4 against the fence. Cut a strip from edge 1. Mark its far end A (first through the blade) and near end B.` : `Keep the marked face up. Turn a quarter turn and put edge ${step - 1} against the fence. Trim the blade-side edge; mark it ${step}.`}</p><div className="step-nav"><button className="text-button" disabled={step === 1} onClick={() => setStep(s => s - 1)}>← Previous</button>{step === 5 ? <a className="text-button" href="#measure">Measure the strip →</a> : <button className="text-button" onClick={() => setStep(s => s + 1)}>Next cut →</button>}</div></div>
            </div>
          </section>
        </div>
        <div className="calculator">
          <section id="measure" aria-labelledby="measure-title">
            <div className="section-heading"><h2 id="measure-title">Measure the strip</h2></div>
            <form id="measurement-form" onSubmit={e => e.preventDefault()} onKeyDown={nextField} noValidate>
              <Measurements draft={draft} unit={unit} setup={active.setup} onChange={(key, value) => updateSession(s => ({ ...s, draft: setDraftField(s.draft, key, value) }))} />
              {badGeometry && <p className="validation" role="alert">Check the numbers. A and B must be smaller than L; their difference cannot exceed 10% of L.</p>}
            </form>
          </section>
          <section className="adjust-section" id="adjust" aria-labelledby="adjust-title">
            <div className="section-heading"><h2 id="adjust-title">Make the adjustment</h2></div>
            <div className={`result ${result ? 'has-result' : ''}`}>
              {!result ? <div className="result-empty">
                <p ref={savedStatus} tabIndex={-1} role="status">{savedTest ? <>Test {savedTest} saved to {isDefaultSledName(active.name) ? 'history' : `“${active.name}”`}. {naming !== active.id && <a href="#cuts">Make the cuts again ↑</a>}</> : 'Enter A, B, L and D to see the move.'}</p>
                {savedTest && naming === active.id && <form className="name-prompt" onSubmit={e => { e.preventDefault(); if (nameDraft.trim()) renameSled(nameDraft.trim()); setNaming(null); }}>
                  <label htmlFor="new-sled-name">Name this sled</label>
                  <div className="name-prompt-row"><input id="new-sled-name" autoFocus maxLength={100} autoComplete="off" placeholder="e.g. Table saw sled" value={nameDraft} onChange={e => setNameDraft(e.target.value)} /><button className="button primary" type="submit" disabled={!nameDraft.trim()}>Save name</button></div>
                  <button type="button" className="text-button" onClick={() => setNaming(null)}>Skip</button>
                </form>}
              </div> : <>
                <div aria-live="polite"><h3 className="move-amount">{format(Math.abs(result.move), unit)} <span>{unit}</span></h3><p className="move-direction">{result.direction === 'none' ? 'No fence move needed.' : <>Move the <strong>{active.setup.pivot === 'left' ? 'right' : 'left'} adjustment point</strong><br /><strong>{result.direction === 'away' ? 'away from you ↑' : 'toward you ↓'}</strong></>}</p></div>
                <AdjustmentDiagram setup={active.setup} move={result.move} />
                <p className="result-advice">{result.direction === 'none' ? 'A and B match.' : `Measure it at D, ${formatInput(fromMM(measurements!.distance, unit), unit)} ${unit} from the pivot, then tighten the fence.`}</p>
              </>}
            </div>
            {result && <form id="move-form" className="move-form" aria-labelledby="record-title" onSubmit={e => { e.preventDefault(); saveTest(); }} noValidate>
              <h3 id="record-title" className="record-title">Record it <span>(optional)</span></h3>
              {result.direction !== 'none' && <MoveField id="actual-move" label="Move you made" unit={unit} amount={moveAmount} direction={moveDirection} suggested={!draft.move} onChange={(amount, direction) => updateSession(s => ({ ...s, draft: { ...s.draft, move: { amount, direction } } }))} onReset={() => updateSession(s => ({ ...s, draft: { ...s.draft, move: undefined } }))} />}
              <button className="button primary record-button" type="submit" disabled={moveInvalid}><span>Save to history <span className="record-target">({active.name})</span></span></button>
            </form>}
            <details className="method-details"><summary>How it works <span aria-hidden="true">＋</span></summary><div>{result && <dl className="result-stats"><div><dt>Strip taper · A − B</dt><dd>{format(result.taper, unit, true)} {unit}</dd></div><div><dt>Fence angle error</dt><dd>{Math.abs(result.errorDegrees).toFixed(5)}°</dd></div></dl>}<p>Four quarter-turns build the fence error into the strip four times over.</p><Equations /></div></details>
          </section>
        </div>
      </div>
      <section className="notebook" id="history" aria-labelledby="history-title">
        <SessionShelf sessions={notebook.sessions} active={active} onSelect={id => { setNotebook(n => ({ ...n, activeId: id })); resetFlow(); }} onNew={newSession} onRename={renameSled} onDelete={deleteSession} />
        <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={e => void importBackup(e.target.files?.[0])} />
      <History key={active.id} trials={active.trials} unit={unit} onMove={(id, move) => { updateSession(s => ({ ...s, trials: s.trials.map(t => t.id === id ? { ...t, actualMove: move } : t) })); setNotice('Move saved.'); }} onDelete={id => { if (confirm('Delete this test and its saved move? You cannot undo this.')) { updateSession(s => ({ ...s, trials: s.trials.filter(t => t.id !== id) })); setNotice('Test deleted.'); } }} />
        <div className="notebook-backups"><button className="text-button" onClick={() => downloadJSON(notebook, `five-cuts-${new Date().toISOString().slice(0, 10)}.json`)}>Export backup</button><button className="text-button" onClick={() => importInput.current?.click()}>Restore backup</button></div>
      </section>
    </main>
    <div className={`toast ${notice.shown ? 'visible' : ''}`} role="status" aria-live="polite">{notice.text}</div>
    <nav className="mobile-nav" aria-label="Workshop navigation"><a href="#sled">Configure</a><a href="#cuts">Cut</a><a href="#measure">Measure</a><a href="#adjust">Adjust</a><a href="#history">History</a></nav>
    <dialog ref={installDialog} className="install-dialog" aria-labelledby="install-title"><div className="dialog-header"><h2 id="install-title">Install Five Cuts</h2><button className="icon-button" aria-label="Close installation help" onClick={() => installDialog.current?.close()}>×</button></div><p>Works offline. Your history stays on this device.</p><p className="connection"><i />{offlineError ? 'Offline setup failed. Reload while online.' : (offlineReady || offlineAvailable) ? 'Offline ready' : 'Getting ready for offline use…'}</p>{installPrompt ? <button className="button primary" onClick={async () => { try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } catch { setNotice('Use your browser menu to install Five Cuts.'); } }}>Install</button> : <><h3>iPhone & iPad</h3><p>In Safari, tap Share, then Add to Home Screen.</p><h3>Android & desktop</h3><p>In your browser menu, choose Install app or Add to Home Screen.</p></>}<p className="version">v0.1</p></dialog>
  </>;
}
export default App;
