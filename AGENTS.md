# AGENTS.md

React 19 + Vite + TypeScript SPA ("ЧПУ CAD/CAM Редактор G-code для простого раскроя ДСП 16 и 32 мм").

## Commands
Package manager is **bun** (`bun.lock` is the committed lockfile). Use `bun install` / `bun run …`, not npm.
- `bun run dev` — Vite dev server on port **3010**, host `0.0.0.0`.
- `bun run build` — production build (Vite). Output is **`dist`** (NOT `build`).
- `bun run typecheck` — strict TypeScript check (`tsc --noEmit`).
- `bun run lint` — runs `tsc --noEmit && oxlint src` (TypeScript + Oxlint config in `.oxlintrc.json`).
- `bun run test` — Vitest one-shot test suite covering G-code, geometry, CAD operations, vector import, store, warnings, canvas geometry, editor helpers, 3D simulation, and numeric utilities.
- `bun install` to add/update deps; keep `bun.lock` committed in sync.

## GitHub Pages deploy
- Pages source is the **`gh-pages`** branch (set via API, not a workflow).
- `bun run deploy` runs `predeploy` (`bun run build`) then `gh-pages -d dist`.
- `vite.config.ts` sets `base: './'` (relative). Built asset URLs become `./assets/…`, so they resolve under any deploy path (e.g. gh-pages `/EZNC-STUDIO-5/`) while `bun run dev` still serves at the root `http://localhost:3010/`. Do not switch back to an absolute `/EZNC-STUDIO-5/` base — it breaks root-relative dev.
- Rebuild trigger when already up to date: `git commit --allow-empty -m "..."; git push` (pages deploy fires on push). To switch source branch: `gh api -X POST repos/<owner>/<repo>/pages -f build_type=legacy -f "source[branch]=gh-pages" -f "source[path]=/"`.

## Architecture
- **Entry & Store**: `src/main.tsx` → `src/App.tsx`; global state lives in a modular Zustand store (`src/store/useProjectStore.ts`) composed of slices (`machineSlice`, `objectsCrudSlice`, `objectsTransformSlice`, `selectionSlice`, `historySlice`, `gcodeSlice`, `projectSlice`, `uiSlice`) with atomic `syncAndSave` and debounced `localStorage` autosave (`projectStoreCore.ts`).
- **Pure logic (`src/lib/`, no React deps)**:
  - `geometry/`: `transform.ts`, `bounds.ts`, `optimizer.ts`, `cadOps.ts` (facade for `trimOps.ts`, `filletOps.ts`, `contourOps.ts`).
  - `gcode/`: `constants.ts` (wire format), `generator.ts`, `parser.ts`, `stats.ts`.
  - `import/`: `vectorImport.ts` (facade for `dxfParser.ts`, `svgParser.ts`, `vectorImport.types.ts`).
  - `io/projectFiles.ts` (file open/save), `postprocessor/templates.ts`, `utils/` (`num.ts`, `id.ts`, `warnings.ts`).
- **Rendering & UI**:
  - **2D Canvas (native HTML5 Canvas2D)**: `src/components/canvas/SceneCanvas.tsx` orchestrating hooks (`useCanvasViewport`, `useCanvasUnderlay`, `useCanvasKeyboard`, `useCanvasGestures`), `canvasToolHandlers.ts`, `sceneCanvasGeometry.ts`, and pure drawers (`drawFrame`, `drawGrid`, `drawCadObjects`, `drawToolpath`, `drawPreview`, `drawOverlays`, `drawUnderlay`). High-frequency pointer/hover/preview states live in refs with coalesced `requestAnimationFrame` repaints.
  - **3D Simulation (React Three Fiber / Three.js)**: `src/components/canvas3d/Scene3D.tsx` + pure builder `buildSimulation.ts`.
  - **G-code Editor (Monaco)**: `src/components/editor/GcodeEditor.tsx` + `gcodePreviewHelpers.ts` (debounced manual parsing).
  - **UI & Panels**: `src/components/panels/`, `src/components/layout/` (with shared `toolDefs.ts`), `src/components/modals/`, `src/components/ui/` (`NumericInput`, `StepperField`, `useNumericDraft`, `useScrub`).
- Path alias `@/*` → project root (both `vite.config.ts` and `tsconfig.json`).

## Conventions / gotchas
- UI text and code comments are in **Russian**.
- `metadata.json` declares `server-side Gemini`, but `src/` has **no** Gemini/`GEMINI_API_KEY` usage yet; env is only documented in `.env.example`.
- PWA: `public/sw.js` is subpath-safe — it resolves every cache path relative to its own location, so it works in the root and under `/EZNC-STUDIO-5/`. Strategy: **network-first** for HTML navigation (fresh deploy loads immediately; offline falls back to the cached `index.html`) and **cache-first** for hashed assets. Cache names carry a `VERSION` so a new deploy invalidates old caches. `src/main.tsx` registers the SW **only when `import.meta.env.PROD`** — never in dev (cache-first there would serve stale Vite modules).
- Vite HMR/file-watching is disabled when `DISABLE_HMR=true` (AI Studio artifact).
- The G-code wire format shared by generator and parser lives in `src/lib/gcode/constants.ts` (object markers, embedded-project tag, numeric assumptions) — change it there, never as duplicated literals in `generator.ts`/`parser.ts`. `src/lib/gcode/gcode.test.ts` pins the round-trip contract and drill-cycle golden output.