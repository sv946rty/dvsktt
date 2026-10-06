#!/usr/bin/env node
// One-way import of the single-file prototype (Reader v4.1 project folder) into content/.
//
//   node tools/import-prototype.mjs path/to/dvsktt-reader-v4.1
//
// Reads  data/data.json                      (Reader text: passages, years, reigns, lexicon …)
//        data/entities/*.json                (entity database + bridge output + Wikipedia files)
// Writes content/lexicon/*.json, content/dvsktt/dinh/** (one JSON file per passage).
//
// Text is copied verbatim: no string in zh / vi / en / notes / groups is changed, only renamed
// keys (gr → groups, v/z/e → vi/zh/en). Passage ids (E01 …) are permanent.
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/import-prototype.mjs path/to/dvsktt-reader-v4.1'); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');  // repository root
const OUT = path.join(ROOT, 'content');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(src, p), 'utf8'));
const wr = (p, obj) => {
  const f = path.join(OUT, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n');
};

const D = rd('data/data.json');

// ---- lexicon (shared by all chapters)
const hanviet = {};
for (const tok of D.dict.split(/\s+/)) {
  if (!tok) continue;
  const c = Array.from(tok)[0];
  hanviet[c] = tok.slice(c.length);          // display form, e.g. "trường/trưởng"
}
wr('lexicon/hanviet.json', hanviet);
wr('lexicon/glossary.json', D.gl);
wr('lexicon/variants.json', D.var);

// ---- chapter
const CH = 'dvsktt/dinh';
const passages = D.entries.map((e) => ({
  id: e.id,
  chapter: 'dinh',
  reign: e.reign,
  year: e.year,
  type: e.type,
  folio: e.folio,
  folios: e.folios,
  page: e.pp,
  zh: e.zh,
  zhPartial: e.zhPartial,
  vi: e.vi,
  en: e.en ?? '',
  notes: e.notes,
  groups: (e.gr || []).map((g) => ({ zh: g.z || [], vi: g.v || [], en: g.e || [] })),
}));
for (const p of passages) wr(`${CH}/passages/${p.id}.json`, p);

wr(`${CH}/chapter.json`, {
  id: 'dinh',
  slug: 'ky-nha-dinh',
  work: 'dvsktt',
  section: 'ban-ky-toan-thu',
  volume: 1,
  title: { zh: '丁紀', vi: 'Kỷ nhà Đinh', en: 'Đinh dynasty annals' },
  span: { from: 968, to: 980, years: 13 },
  sources: {
    zh: 'Wikisource transcription of the woodblock edition',
    vi: 'Vietnamese translation, extracted from PDF (private: copyright permission not obtained)',
    en: 'AI-assisted draft translated from the Chinese, not yet edited',
  },
  reigns: D.reigns,
  years: D.years,
  passages: passages.map((p) => p.id),
});
wr(`${CH}/discussions.json`, D.forum);
wr(`${CH}/parallel-sources.json`, D.src);

// ---- entities (copied unchanged)
for (const f of ['entities.json', 'relations.json', 'review.json', 'reader-entities.json', 'bridge-report.json',
  'wikipedia-enrichment.json', 'wikipedia-review.json', 'PROVENANCE.json', 'schema-v1.json']) {
  const p = path.join(src, 'data/entities', f);
  if (fs.existsSync(p)) {
    fs.mkdirSync(path.join(OUT, CH, 'entities'), { recursive: true });
    fs.copyFileSync(p, path.join(OUT, CH, 'entities', f));
  }
}
console.log(`imported ${passages.length} passages, ${Object.keys(hanviet).length} Hán-Việt readings into content/`);
