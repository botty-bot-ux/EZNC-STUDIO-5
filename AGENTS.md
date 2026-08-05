# AGENTS.md

React 19 + Vite + TypeScript SPA ("ЧПУ CAD/CAM Редактор G-code") built as a Google AI Studio applet. Single page, no router.

## Commands
- `npm run dev` — Vite dev server on port **3000**, host `0.0.0.0`.
- `npm run build` — production build (Vite). Output is **`dist`** (NOT `build`).
- `npm run lint` — NOT a linter; it is `tsc --noEmit` (typecheck). Use it to verify types. There is no ESLint.
- `npm install --save-dev gh-pages` was applied, so a `package-lock.json` exists locally but is untracked. Keep changes in sync with the committed **`bun.lock`** if you add deps.

## GitHub Pages deploy
- Pages source is the **`gh-pages`** branch (set via API, not a workflow).
- `npm run deploy` runs `predeploy` (`npm run build`) then `gh-pages -d dist`.
- `vite.config.ts` sets `base: '/EZNC-STUDIO-5/'` so asset URLs work under the project subpath. Do not remove it.
- Rebuild trigger when already up to date: `git commit --allow-empty -m "..."; git push` (pages deploy fires on push). To switch source branch: `gh api -X POST repos/<owner>/<repo>/pages -f build_type=legacy -f "source[branch]=gh-pages" -f "source[path]=/"`.

## Architecture
- `src/main.tsx` entry → `src/App.tsx`; global state is a single Zustand store `src/store/useProjectStore.ts` (undo/redo, selections, machine settings).
- `src/lib/` is pure logic: `geometry/` (transform, optimizer), `gcode/` (parser, generator), `postprocessor/templates.ts`, `utils/warnings.ts`. No React deps — testable in isolation.
- Rendering layers: Konva canvas `src/components/canvas/SceneCanvas.tsx`, Monaco editor `src/components/editor/GcodeEditor.tsx`, panels in `src/components/panels/`, layout/modals in `src/components/layout|modals/`.
- Path alias `@/*` → project root (both `vite.config.ts` and `tsconfig.json`).

## Conventions / gotchas
- UI text and code comments are in **Russian**.
- `metadata.json` declares `server-side Gemini`, but `src/` has **no** Gemini/`GEMINI_API_KEY` usage yet; env is only documented in `.env.example`.
- PWA: `public/sw.js` registers and serves cache-first from `/sw.js` and `manifest.json` with **absolute** paths — will not resolve under the GitHub Pages subpath, so PWA is effectively broken when deployed to gh-pages. Keep this in mind before touching SW/PWA.
- Vite HMR/file-watching is disabled when `DISABLE_HMR=true` (AI Studio artifact).
- No tests exist; no test framework configured.