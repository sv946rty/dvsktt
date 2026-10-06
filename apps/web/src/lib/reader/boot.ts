// Data handed to the client components. Kept small: the full text is already in the HTML,
// entities and the search index are fetched from static JSON routes when first needed.
import type { LoadedChapter } from '../content/load';
import type { Discussion, Reign, Work, Year } from '@dvsktt/core';
import { plainVi, plainZh } from '@dvsktt/core';

export type BootEntry = { id: string; year: string; reign: string; type: string; folio: string; pp: number; vi: string; en: string };
export type Boot = {
  slug: string;
  work: Work;
  title: { zh: string; vi: string; en: string };
  span: { from: number; to: number; years: number };
  reigns: Reign[];
  years: Year[];
  entries: BootEntry[];
  lexicon: { hanviet: Record<string, string>; glossary: Record<string, string>; variants: Record<string, string> };
  discussions: Discussion[];
  parallel: Record<string, { t: string; d: string }[]>;
  stats: { passages: number; zh: number; groups: number; entities: number; mentions: number };
};

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function makeBoot(slug: string, work: Work, d: LoadedChapter, lexicon: Boot['lexicon'], applied: number): Boot {
  return {
    slug,
    work,
    title: d.chapter.title,
    span: d.chapter.span,
    reigns: d.chapter.reigns,
    years: d.chapter.years,
    entries: d.passages.map((p) => ({ id: p.id, year: p.year, reign: p.reign, type: p.type, folio: p.folio, pp: p.page, vi: cut(plainVi(p.vi), 100), en: cut(p.en, 100) })),
    lexicon,
    discussions: d.discussions,
    parallel: d.parallel,
    stats: {
      passages: d.passages.length,
      zh: d.passages.filter((p) => p.zh).length,
      groups: d.passages.reduce((a, p) => a + p.groups.length, 0),
      entities: Object.keys(d.entities.entities).length,
      mentions: applied,
    },
  };
}

export type SearchDoc = { id: string; year: string; reign: string; vi: string; zh: string; en: string };
export const searchDocs = (d: LoadedChapter): SearchDoc[] =>
  d.passages.map((p) => ({ id: p.id, year: p.year, reign: p.reign, vi: plainVi(p.vi), zh: p.zh ? plainZh(p.zh) : '', en: p.en }));

/** Compact entity bundle for the card. Mention index = data-m in the sheet. */
export type EntBundle = {
  entities: LoadedChapter['entities']['entities'];
  relations: LoadedChapter['entities']['relations'];
  mentions: { e: string; en: string; l: 'zh' | 'vi'; tg: 'body' | 'note'; n?: number; t: string; c: [string, string]; rv?: 1 }[];
  enrichment: { status?: string };
};
export const entBundle = (d: LoadedChapter): EntBundle => ({
  entities: d.entities.entities,
  relations: d.entities.relations,
  mentions: d.entities.mentions.map((m) => ({
    e: m.entityId, en: m.entryId, l: m.lang, tg: m.target, t: m.text, c: m.context,
    ...(m.target === 'note' ? { n: m.noteIndex } : {}), ...(m.reviewRequired ? { rv: 1 as const } : {}),
  })),
  enrichment: { status: d.entities.enrichment.status },
});
