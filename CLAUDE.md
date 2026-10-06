# Notes for agents

* Monorepo with npm workspaces: `content/` (JSON texts), `packages/core` (schemas + render model),
  `apps/web` (Next.js 16, App Router). Read `apps/web/AGENTS.md` before changing Next.js code: this
  Next.js version differs from older training data (async `params`, `PageProps`, Turbopack).
* Never edit text in `content/**/passages/*.json` as a side effect of code work. Passage ids are permanent.
* The Vietnamese translation is private; do not publish pages or deploy without the owner's go-ahead.
* Before pushing: `npm run validate && npm test && npm run lint && npm run typecheck && npm run build`.
  The reader's markup must stay identical to the v4.1 prototype unless a change is intended
  (`apps/web/tests/parity.mjs`).
