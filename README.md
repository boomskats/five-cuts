# Five Cuts

Five-cut method calculator for squaring a crosscut sled fence. Works offline; tests are saved in the browser.

https://fivecunts.com

## Using it

1. **Configure your sled.** Looking from the infeed side: which side of the blade the board is on, which edge of the board sits against the fence, and which end of the fence pivots.
2. **Make the cuts.** Follow the five illustrated cuts, always putting the fresh edge against the fence with the same face up. Mark the fifth strip A (far end) and B (near end) before removing it.
3. **Measure the strip.** Widths A and B, the span L between those two measurements, and D along the fence from the pivot to where you'll make the adjustment.
4. **Make the adjustment.** Move the indicated end of the fence by the amount shown, measured at D, and tighten it.
5. **Record it (optional).** Change the move if you made a different one, then save. History groups tests by sled, with taper and move graphs.

Units are mm or decimal inches. History can export and restore a JSON backup. Data isn't synced between devices or browsers, and clearing site data removes it.

For crosscut fences only, not rip fences. Not yet validated on a real saw: make a modest move first and check that the taper goes down.

## Maths

```text
correction = bladeSign × atan((A − B) / L) / 4
move       = pivotSign × D × sin(correction)

bladeSign: +1 board left of blade, −1 board right
pivotSign: +1 pivot on the left,   −1 pivot on the right
move > 0:  away from you
```

Four quarter-turns put four times the fence error into the strip. For workshop-sized errors this matches the usual `(A − B) / 4 / L × D`. Whether the fence is at the near or far edge changes the rotation direction, not the sign. The calculation lives in `src/domain.ts`.

## Development

Node 22.12+.

```sh
npm ci
npm run dev                         # http://localhost:5173, no service worker
npm run build && npm run preview    # offline-capable build at http://localhost:4173
npm test                            # unit tests
npm run test:e2e                    # Playwright, desktop and mobile Chrome
```

The service worker and install prompt need HTTPS (or localhost). Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Page views are counted with GoatCounter (script tag in `index.html`).

Data is stored in localStorage under `five-cuts.notebook.v1` as versioned JSON, with measurements in millimetres.

## Source

- `src/App.tsx`: page and workflow
- `src/domain.ts`: geometry, units and parsing
- `src/storage.ts`: storage validation and backups
- `src/BenchDiagram.tsx`, `src/cut-animation.ts`: animated cuts
- `src/Measurements.tsx`, `src/Illustrations.tsx`: inputs and diagrams
- `src/History.tsx`, `src/SessionShelf.tsx`: tests, graphs and sleds
- `vite.config.ts`: PWA manifest and offline caching

Font: Goudy Bookletter 1911, SIL Open Font License (`public/fonts/OFL.txt`).
