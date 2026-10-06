// Build-time content loading (server only). Content lives in /content as JSON in Git.
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { z } from 'zod';
import { Chapter, Discussion, ParallelSources, Passage, ReaderEntities, Work } from '@dvsktt/core';

const CONTENT = path.join(process.cwd(), '../../content');
const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(path.join(CONTENT, p), 'utf8'));
const parse = <T extends z.ZodTypeAny>(schema: T, p: string): z.infer<T> => {
  const r = schema.safeParse(readJson(p));
  if (!r.success) throw new Error(`content/${p} does not match its schema:\n${z.prettifyError(r.error)}`);
  return r.data;
};

/** Chapters that exist, by URL slug. */
export const CHAPTERS: Record<string, { work: string; dir: string }> = {
  'ky-nha-dinh': { work: 'dvsktt', dir: 'dvsktt/dinh' },
};

export const loadLexicon = cache(() => ({
  hanviet: parse(z.record(z.string(), z.string()), 'lexicon/hanviet.json'),
  glossary: parse(z.record(z.string(), z.string()), 'lexicon/glossary.json'),
  variants: parse(z.record(z.string(), z.string()), 'lexicon/variants.json'),
}));

export const loadWork = cache((id: string) => parse(Work, `${id}/work.json`));

export const loadChapter = cache((slug: string) => {
  const c = CHAPTERS[slug];
  if (!c) return null;
  const chapter = parse(Chapter, `${c.dir}/chapter.json`);
  const passages = chapter.passages.map((id) => {
    const p = parse(Passage, `${c.dir}/passages/${id}.json`);
    if (p.id !== id) throw new Error(`content/${c.dir}/passages/${id}.json has id ${p.id}`);
    return p;
  });
  return {
    chapter,
    passages,
    discussions: parse(z.array(Discussion), `${c.dir}/discussions.json`),
    parallel: parse(ParallelSources, `${c.dir}/parallel-sources.json`),
    entities: parse(ReaderEntities, `${c.dir}/entities/reader-entities.json`),
  };
});
export type LoadedChapter = NonNullable<ReturnType<typeof loadChapter>>;
