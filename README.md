# Five Cuts

A quiet, offline workshop instrument for tuning a crosscut sled or mitre-gauge fence with the five-cut method.

**https://fivecunts.com**

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

Open **http://localhost:4173**. Choose **Install app** and wait for **Offline ready** in that dialog, then install from it or your browser menu. The development server deliberately does not register a service worker.

For phone installation, serve `dist/` from an **HTTPS** static host. An HTTP LAN IP is fine for an online layout preview, but is not a secure context and will not support service workers/installability. `localhost` is the development exception. `base: './'` supports a static subdirectory as well as a domain root. Serve the app directory with a trailing slash. No API or server-side environment variables are needed.

The service worker precaches the complete app, including icons. Updates appear in a sticky, muted-ochre header rather than interrupting a measurement. Accepting an update waits for the new worker to take control, then reloads; drafts and recorded tests stay saved. This also handles updates arriving in the same window as the first install. Avoid long-lived immutable caching for `index.html`, `sw.js`, and `manifest.webmanifest`; hashed JS/CSS assets may be cached immutably.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: unit tests, production build, then GitHub Pages. The custom domain is set in the repository's Pages settings, and the domain's DNS points at GitHub Pages.

## Workshop workflow

The page follows the job, top to bottom: **Configure your sled → Make the cuts → Measure the strip → Make the adjustment → History**. The phone nav uses the same words.

1. Choose mm or inches in the header. A sled is created automatically. The first time you save a test for it, you're asked to name it (or skip). The selected sled's card in History has a ✎ to rename it, and the save button names the sled the test goes to: **Save to history (Crosscut sled)**.
2. **Configure your sled.** Stand at the **infeed side**, looking along the feed direction. Select:
   - the board's side of the blade;
   - the fence's **near or far edge of the board**;
   - the fixed pivot's **left or right side relative to your adjustment point**.
3. **Make the cuts.** Follow the five illustrated cuts. Each step plays once: lift clear, rotate, seat the reference edge, trace the cut and release a shaving. The panel keeps its smaller shape, and cut five releases a wider A/B measuring strip. **Replay cut** repeats just that step. Reduced-motion mode shows the finished state immediately. The app derives the rotation direction: **always put the freshly cut edge against the fence**, keeping the same face up. On the fifth strip, label **A = far/leading end** and **B = near/trailing end** before removing it.
4. **Measure the strip.** Enter widths A and B, span L **between the actual measurement locations**, and D **along the fence from the pivot to where you will measure your move**. Enter moves to the next field.
5. **Make the adjustment.** Move the indicated end by the amount shown, measured at D, and tighten the fence. **Move you actually made** starts at the suggestion; change it if you moved a different amount, or ↺ to go back to the suggestion. Leave it empty if you didn't record the move.
6. **Save to history (sled name).** This records the readings with the move you made, clears A/B for the next test, keeps L/D, and returns the cut guide to cut 1.

All measurement fields use the selected unit. Millimetres are the default; inches are decimal, not fractional. A decimal comma is accepted. Switching units converts drafts and display values; stored test measurements remain in millimetres. Converted draft values display up to six decimal places in mm or seven in inches, without trailing zeroes. Optional `draft.exactMM` entries retain the original value behind its displayed conversion, so repeated unit switching and reloads do not accumulate rounding error. The drafted actual move (`draft.move`) is kept across reloads and unit switches too; while it is untouched, saving records the exact suggestion rather than its rounded display.

After a saved test, the sled choices remain active. Changing one starts a new sled with the new orientation and keeps earlier tests and unfinished readings under the old one; a brief note says so. **History → New sled** starts a fresh sled with the same choices. D carries forward. Reopen any sled from History to see its tests or test it again.

Confirmations (move saved, test deleted, backup restored and so on) appear briefly as a toast above the phone nav.

### Reading the history

- Sled cards are visible at the top of History, even without tests. Select one to see its tests below. Cards show **No tests**, **Draft**, or a test count.
- Renaming (✎), deletion and backups are in History.
- One **test** = one complete set of five cuts, plus the move you made afterwards.
- The taper graph plots **A − B**, with zero as the goal. Keep L consistent for a direct comparison; every test retains its own L and D.
- The moves graph separates suggestions (open circles/dashes) from moves made (filled squares). **Positive = away from you; negative = toward you.** An empty move leaves a gap.
- Each test shows raw measurements, change in taper from the previous test, the suggestion, timestamp, and an editable **Move made after test N** (↺ resets it to the suggestion; empty = not recorded). **Delete test N** removes the whole test.
- Each sled can be reopened, renamed and deleted. Deletion asks for confirmation.

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

- **History → Export backup** downloads all sleds, tests and drafts.
- **History → Restore backup** validates and replaces everything, with confirmation. Export first if you need to keep what's there.
- Invalid stored JSON is not silently overwritten: the app offers a download of the original bytes and an explicit reset.
- Storage/quota failures are visible. Keep the page open and export current work if saving fails.
- No sync between devices, browser profiles, or origins. An installed iOS copy may have separate storage from the browser.
- Private browsing and clearing site data can remove sessions. Browser persistence is not a backup.
- Use one active app window at a time; simultaneous editing in multiple windows is not conflict-merged in v0.1.

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

- `src/App.tsx` — page shell, sled configuration, guided workflow, measuring and saving
- `src/domain.ts` — geometry, units and measurement parsing
- `src/storage.ts` — versioned notebook validation, persistence and export
- `src/Measurements.tsx` — diagram-integrated A/B/L inputs and separate pivot-distance field
- `src/Illustrations.tsx` — orientation choices, strip and adjustment diagrams
- `src/BenchDiagram.tsx`, `src/PanelMarkings.tsx` — animated cutting scene and permanent handwritten marks
- `src/cut-animation.ts`, `src/useCutAnimation.ts` — retained-material geometry, one-shot timeline, replay and reduced-motion handling
- `src/History.tsx` — per-test records, editable moves and SVG graphs
- `src/MoveField.tsx` — the “move you made” amount/direction/reset field, shared by the adjustment step and History
- `src/SessionShelf.tsx` — sled cards, selection and deletion
- `src/SledName.tsx` — inline rename field and ✎ icon for the selected sled card, and the default-name check behind the first-save prompt
- `src/strip-geometry.ts` — proportional measured-strip drawing geometry
- `src/Equations.tsx` — native MathML equations, available offline
- `src/UpdateNotice.tsx`, `src/app-update.ts` — sticky update notice and explicit worker activation
- `src/styles.css`, `src/tokens.css`, `src/assets/goudy-bookletter-1911.woff` — photocopied-paper palette and texture, and self-hosted Goudy Bookletter 1911 (SIL OFL, `public/fonts/OFL.txt`)
- `vite.config.ts` — PWA manifest, icons and offline strategy
