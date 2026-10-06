// Validates everything under content/ and checks that the render model is complete:
// every passage parses, every clause group aligns, every placed entity mention lands on its text.
//   npm run validate   (from the repository root)
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { buildPassage, Chapter, Discussion, ParallelSources, Passage, ReaderEntities, Work, type MentionRef } from '../src';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const C = path.join(ROOT, 'content');
let problems = 0;
const fail = (m: string) => { problems++; console.error('✗ ' + m); };
const read = <T extends z.ZodTypeAny>(s: T, p: string): z.infer<T> | null => {
  const r = s.safeParse(JSON.parse(fs.readFileSync(path.join(C, p), 'utf8')));
  if (!r.success) { fail(`content/${p}\n${z.prettifyError(r.error)}`); return null; }
  return r.data;
};

const lex = {
  hanviet: read(z.record(z.string(), z.string()), 'lexicon/hanviet.json') ?? {},
  variants: read(z.record(z.string(), z.string()), 'lexicon/variants.json') ?? {},
};
read(z.record(z.string(), z.string()), 'lexicon/glossary.json');

for (const work of fs.readdirSync(C).filter((d) => fs.existsSync(path.join(C, d, 'work.json')))) {
  read(Work, `${work}/work.json`);
  for (const ch of fs.readdirSync(path.join(C, work)).filter((d) => fs.existsSync(path.join(C, work, d, 'chapter.json')))) {
    const dir = `${work}/${ch}`;
    const chapter = read(Chapter, `${dir}/chapter.json`);
    if (!chapter) continue;
    read(z.array(Discussion), `${dir}/discussions.json`);
    read(ParallelSources, `${dir}/parallel-sources.json`);
    const ent = read(ReaderEntities, `${dir}/entities/reader-entities.json`);
    const files = fs.readdirSync(path.join(C, dir, 'passages')).map((f) => f.replace(/\.json$/, ''));
    const missing = chapter.passages.filter((id) => !files.includes(id)), extra = files.filter((f) => !chapter.passages.includes(f));
    if (missing.length) fail(`${dir}: passages listed but missing: ${missing.join(', ')}`);
    if (extra.length) fail(`${dir}: passage files not listed in chapter.json: ${extra.join(', ')}`);
    const years = new Set(chapter.years.map((y) => y.id)), reigns = new Set(chapter.reigns.map((r) => r.id));
    let applied = 0, groups = 0;
    for (const id of chapter.passages) {
      const p = read(Passage, `${dir}/passages/${id}.json`);
      if (!p) continue;
      if (p.id !== id) fail(`${dir}/passages/${id}.json: id is ${p.id}`);
      if (!years.has(p.year)) fail(`${id}: unknown year ${p.year}`);
      if (!reigns.has(p.reign)) fail(`${id}: unknown reign ${p.reign}`);
      if ((p.vi.match(/\{n\d+\}/g) || []).length !== p.notes.length) fail(`${id}: footnote markers and notes differ`);
      groups += p.groups.length;
      const ms: MentionRef[] = (ent?.mentions || []).map((m, i) => ({ i, m, label: '' })).filter((x) => x.m.entryId === id);
      const model = buildPassage(p, lex, ms, (w) => fail(w));
      applied += model.stats.applied;
    }
    const total = ent?.mentions.length ?? 0;
    if (ent) for (const m of ent.mentions) if (!ent.entities[m.entityId]) fail(`mention ${m.mentionId}: unknown entity ${m.entityId}`);
    if (ent) for (const r of ent.relations) for (const e of [r.subject, r.object]) if (!ent.entities[e]) fail(`relation ${r.relation_id}: unknown entity ${e}`);
    console.log(`${dir}: ${chapter.passages.length} passages, ${groups} clause groups, ${applied}/${total} entity mentions placed, ${ent ? Object.keys(ent.entities).length : 0} entities`);
    if (applied !== total) fail(`${dir}: ${total - applied} entity mentions could not be placed`);
  }
}
if (problems) { console.error(`\n${problems} problem(s)`); process.exit(1); }
console.log('content OK');
