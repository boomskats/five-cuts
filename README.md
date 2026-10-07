# Five Cuts

A quiet, offline workshop instrument for tuning a crosscut sled or mitre-gauge fence with the five-cut method.

Vite · React · TypeScript · SVG · localStorage · Workbox PWA. No backend, accounts, analytics, remote fonts, or runtime network dependencies.

## Run

Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Development runs at **http://localhost:5173**. For the installable, offline-enabled build:

```sh
npm run build
npm run preview -- --port 4173
```

Open **http://localhost:4173**. Wait for **Offline ready**, then install through the app button or your browser menu. The development server deliberately does not register a service worker.

For phone installation, serve `dist/` from an **HTTPS** static host. An HTTP LAN IP is fine for an online layout preview, but is not a secure context and will not support service workers/installability. `localhost` is the development exception. `base: './'` supports a static subdirectory as well as a domain root. Serve the app directory with a trailing slash. No API or server-side environment variables are needed.

The service worker precaches the complete app, including icons. Updates appear in a sticky, muted-ochre header rather than interrupting a measurement. Accepting an update waits for the new worker to take control, then reloads; drafts and recorded tests stay saved. This also handles updates arriving in the same window as the first install. Avoid long-lived immutable caching for `index.html`, `sw.js`, and `manifest.webmanifest`; hashed JS/CSS assets may be cached immutably.

## Workshop workflow

1. Choose mm or inches. A saved setup is created automatically; you can name it in the notebook.
2. Stand at the **infeed side**, looking along the feed direction. Select:
   - the board's side of the blade;
   - the fence's **near or far edge of the board**;
   - the fixed pivot's **left or right side relative to your adjustment point**.
3. Follow the five illustrated cuts. Each step plays once: lift clear, rotate, seat the reference edge, trace the cut and release a shaving. The panel keeps its smaller shape, and cut five releases a wider A/B measuring strip. **Replay cut** repeats just that step without changing measurements or recorded tests. Reduced-motion mode shows the finished state immediately. The app derives the rotation direction: **always put the freshly cut edge against the fence**, keeping the same face up.
4. On the fifth strip, label **A = far/leading end**, **B = near/trailing end**, before removing it. These labels never depend on how you hold the strip later.
5. Measure widths A and B, span L **between the actual measurement locations**, and D **along the fence from the pivot to where you will measure your move**.
6. Inspect the live preview and **Record test**. Quick-save records the readings and pre-populates the actual adjustment with the suggested move. It clears A/B for the next reading, retains L/D, and keeps the recorded recommendation visible.
7. Adjust at D as shown and retighten. If you make a different move, edit the adjustment in the notebook. Repeat all five cuts on the next test.

All four measurement fields use the selected unit. Millimetres are the default; inches are decimal, not fractional. A decimal comma is accepted. Switching units converts drafts and display values; stored test measurements remain in millimetres. Converted draft values display up to six decimal places in mm or seven in inches, without trailing zeroes. Optional `draft.exactMM` entries retain the original value behind its displayed conversion, so repeated unit switching and reloads do not accumulate rounding error. Editing a field replaces that field’s backing value. Earlier saved drafts remain compatible; old floating-point display tails are cleaned when loaded.

After a recorded test, the setup choices remain active. Changing one creates a fresh setup with the new orientation and keeps earlier tests and unfinished readings under the old one. The dark **New setup** button appears beside the saw heading too; it starts a fresh setup with the same choices. D carries forward. Reopen any saved setup from the notebook to see its tests or repeat the test on that saw.

### Reading the notebook

- Saved setup cards are visible at the top of the notebook, even without tests. Select one to see its readings below. Cards show **No tests**, **Draft**, or a test count.
- Naming, deletion and backups are in the notebook. **New setup** is also beside the saw choices once a test has been recorded.
- One **test** = one complete set of five cuts.
- The taper graph plots **A − B**, with zero as the goal. Keep L consistent for a direct comparison; every test retains its own L and D.
- The adjustment graph separates recommendations (open circles/dashes) from logged moves (filled squares). **Positive = away from you; negative = toward you.** Quick-save assumes the suggested move was used; editing the move updates the graph. Clearing a move leaves a gap. Existing unrecorded moves from earlier versions stay unrecorded.
- Each test shows raw measurements, change in taper from the preceding retained test, recommendation, timestamp, and editable actual move.
- Each session can be reopened, renamed and deleted. Deletion asks for confirmation.

## Geometry and conventions

`src/domain.ts` is the independently testable calculation module.

Take x to the operator's right, y away from the operator, and α as the fence's signed angle relative to a square fence. Four registered quarter-turns put the original cut edge at four times that error:

```text
Right-side blade / board on left: (A − B) / L = −tan(4α)
Left-side blade / board on right: (A − B) / L = +tan(4α)

correction = bladeSign × atan((A − B) / L) / 4
move       = pivotSign × D × sin(correction)

bladeSign: +1 for board left; −1 for board right
pivotSign: +1 for pivot left; −1 for pivot right
move > 0: away from you; move < 0: toward you
```

D is the radial distance along the fence to the adjustment point; the reported move is the feed-axis displacement needed to square it. At workshop-scale errors this agrees with the familiar `(A − B) / 4 / L × D` approximation. The near/far fence position changes the required panel rotation, **not** the correction sign.

The upright strip drawing places A/B inputs beside their measuring points and L beside the span. D has a separate fence/pivot dimension drawing below. With A, B and L entered, the strip uses one uniform scale to fit the measured section: its width/span ratios and taper follow the entered values, with the straight blade-cut edge mirrored by board side. Until then it shows a schematic. The handwritten “up” and edge numbers 1–4 stay attached to the panel through each quarter-turn; cut five returns to edge 1. Fence movement remains enlarged for visibility, with a 2.09-second outward movement and a 0.18-second reset. The model assumes flat stock, consistent edge registration and a repeatable cut. Input validation rejects nonpositive dimensions, strips as wide as their measured span, and taper ratios above 10%.

**For crosscut fences, not rip-fence alignment.** Follow the saw manufacturer's guards/workholding guidance. Never trap the strip against a rip fence. Stop before retrieving the strip; disconnect power before adjustments.

## Local data and backups

Storage key: `five-cuts.notebook.v1`, versioned JSON. Raw measurements and signed actual moves are stored in millimetres. Sessions have UUIDs and ISO creation/update timestamps; each test has its own timestamp and setup snapshot.

- **Export notebook** downloads all sessions and drafts.
- **Notebook → Restore backup** validates and replaces the entire notebook, with confirmation. Export first if you need to preserve the existing notebook.
- Invalid stored JSON is not silently overwritten: the app offers a download of the original bytes and an explicit reset.
- Storage/quota failures are visible. Keep the page open and export current work if saving fails.
- No sync between devices, browser profiles, or origins. An installed iOS copy may have separate storage from the browser.
- Private browsing and clearing site data can remove sessions. Browser persistence is not a backup.
- Use one active app window for a notebook; simultaneous editing in multiple windows is not conflict-merged in v0.1.

## Validation

```sh
npm test            # calculation, all mirrored geometries, units, storage validation
npm run build       # TypeScript + production bundle + precached service worker
npm run test:e2e    # desktop and mobile Chrome; production build required
npm audit
```

Playwright uses the locally installed **Google Chrome** channel (install it with `npx playwright install chrome` if necessary). With no server running, it builds and starts one; if you have a preview already running at 4173, build first so the tests exercise current source. Test state lives in isolated browser contexts, not your real notebook.

Geometry tests construct measurements by rotating a first-cut edge four times, using cut/fence surface normals, across every blade/fence/pivot combination and errors of both signs. Browser tests cover recordings, actual-move history, mirrored configuration, units, reloads, sessions and deletion, backup restore, malformed data, narrow layouts, reduced motion, manifest/icons, and **offline reloads plus further calculations**. Additional regression tests cover repeated unit roundtrips, retained panel rotation, proportional mirrored strip shapes, MathML equations, and a real waiting-worker update with a pinned banner and draft-preserving reload. Cutting-animation tests check conserved material, cumulative trimming, clearance during rotation, the wider fifth strip, replay, interrupted navigation and live reduced-motion changes.

The first version has been computationally/browser tested, **not yet physically validated on a saw**. For the initial IRL check: record the baseline, make a modest known move in the indicated direction, record the actual amount, then repeat the test. Taper should decrease. If it increases, stop and verify A/B, pivot location, panel rotation and reference-edge seating before continuing. Export that session to make troubleshooting reproducible.

## Source map

- `src/App.tsx` — session shell, setup, guided workflow and form
- `src/domain.ts` — geometry, units and measurement parsing
- `src/storage.ts` — versioned notebook validation, persistence and export
- `src/Measurements.tsx` — diagram-integrated A/B/L inputs and separate pivot-distance field
- `src/Illustrations.tsx` — orientation choices, strip and adjustment diagrams
- `src/BenchDiagram.tsx`, `src/PanelMarkings.tsx` — animated cutting scene and permanent handwritten marks
- `src/cut-animation.ts`, `src/useCutAnimation.ts` — retained-material geometry, one-shot timeline, replay and reduced-motion handling
- `src/History.tsx` — actual adjustments, trial records and SVG graphs
- `src/SessionShelf.tsx` — visible session cards, names, selection and backup controls
- `src/strip-geometry.ts` — proportional measured-strip drawing geometry
- `src/Equations.tsx` — native MathML equations, available offline
- `src/UpdateNotice.tsx`, `src/app-update.ts` — sticky update notice and explicit worker activation
- `src/styles.css`, `src/tokens.css`, `src/assets/goudy-bookletter-1911.woff` — high-contrast book-paper palette and self-hosted Goudy Bookletter 1911 (SIL OFL, `public/fonts/OFL.txt`)
- `vite.config.ts` — PWA manifest, icons and offline strategy
