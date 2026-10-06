# Đại Việt Sử Ký Toàn Thư: web reader

Read Đại Việt sử ký toàn thư side by side in Classical Chinese, Vietnamese and English, with
clause-by-clause alignment, a Hán-Việt character dictionary and cards for people, places and
polities. **Private prototype: the Vietnamese translation is not cleared for publication.**

```
content/          texts, lexicon and entity data as JSON (see content/README.md)
packages/core/    shared TypeScript: content schemas (zod) and the passage render model
apps/web/         Next.js app (App Router, React 19, Tailwind 4), statically generated
tools/            import-prototype.mjs (one-way import from the single-file prototype)
```

The mobile app lives in a separate repository, `dvsktt-mobile`, and uses the same content and core.

## Run it

Node 20 or newer.

```bash
npm install
npm run dev            # http://localhost:3000  → open "Kỷ nhà Đinh"
```

Production build:

```bash
npm run build && npm start
```

## Checks

```bash
npm run validate       # every content file against its schema; alignment and entity placement complete
npm test               # unit tests of the render model
npm run lint && npm run typecheck
# browser tests (needs a running server and Playwright's Chromium: npx playwright install chromium)
npm run test:e2e -- http://localhost:3000/ky-nha-dinh
```

`apps/web/tests/parity.mjs` compares every passage's markup with the v4.1 prototype file
(`node apps/web/tests/parity.mjs path/to/dvsktt-reader-v4.1.html http://localhost:3000/ky-nha-dinh`).

## How the reader works

* `/[chapter]` is generated at build time. `packages/core` turns each passage into a render tree:
  Chinese characters with readings and variant forms, the Vietnamese/English markup, clause groups
  and entity mentions (offsets come from the entity bridge). The server renders it to HTML once.
* The client (`apps/web/src/components/reader/client`) adds the behaviour: clause pairing on hover
  or tap, the entity card, character dictionary, search, table of contents, settings, focus mode
  and correction discussions. Hover feedback toggles classes on the static text instead of
  re-rendering it.
* Preferences are classes on `<html>` set before first paint, so layout, language and theme changes
  never re-render the text.
* Entity data and the search index are static JSON routes (`/data/<chapter>/entities.json`,
  `/data/<chapter>/search.json`) loaded on first use.
* The stylesheet (`apps/web/src/app/reader.css`) is the prototype's, so the design stays identical.
  Tailwind is available for new screens (the home page uses it).

## Roadmap

Phase 0 data and schemas ✓ · Phase 1 Next.js reader ✓ · Phase 2 accounts, corrections, search
(Drizzle, Better Auth, Supabase Postgres) · Phase 3 more volumes · Phase 4 React Native app.
