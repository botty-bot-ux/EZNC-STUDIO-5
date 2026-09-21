# AGENTS.md

React 19 + Vite + TypeScript SPA ("ЧПУ CAD/CAM Редактор G-code для проостого раскроя дсп 16 и 32мм") .

## Commands
Package manager is **bun** (`bun.lock` is the committed lockfile). Use `bun install` / `bun run …`, not npm.
- `bun run dev` — Vite dev server on port **3010**, host `0.0.0.0`.
- `bun run build` — production build (Vite). Output is **`dist`** (NOT `build`).
- `bun run lint` — NOT a linter; it is `tsc --noEmit` (typecheck). Use it to verify types. There is no ESLint.
- `bun install` to add/update deps; keep `bun.lock` committed in sync.

## GitHub Pages deploy
- Pages source is the **`gh-pages`** branch (set via API, not a workflow).
- `bun run deploy` runs `predeploy` (`bun run build`) then `gh-pages -d dist`.
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
- Tests: `bun run test` (vitest, one-shot; run it after touching `src/lib/gcode/`). The G-code wire format shared by generator and parser lives in `src/lib/gcode/constants.ts` (object markers, embedded-project tag, numeric assumptions) — change it there, never as duplicated literals in `generator.ts`/`parser.ts`. `src/lib/gcode/gcode.test.ts` pins the round-trip contract and drill-cycle golden output.