// Content schemas. Every JSON file under content/ is parsed with these at build time, so a
// malformed edit fails the build instead of rendering wrong text.
import { z } from 'zod';

export const PassageId = z.string().regex(/^[A-Z]\d{2,}$/, 'passage ids look like E01, F12');

export const ClauseGroup = z.object({
  zh: z.array(z.string()),
  vi: z.array(z.string()),
  en: z.array(z.string()),
});

export const Passage = z.object({
  id: PassageId,
  chapter: z.string(),
  reign: z.string(),
  year: z.string(),
  type: z.enum(['summary', 'annal', 'narr', 'comment', 'assess']),
  folio: z.string(),
  folios: z.array(z.string()),
  page: z.number().int(),
  /** Classical Chinese. ⚑ marks a doubtful next character, 〈 〉 enclose small-print notes. */
  zh: z.string(),
  zhPartial: z.boolean(),
  /** Vietnamese. |1b| folio break, {n1} footnote ref, ⟦ ⟧ translator insertion, ⟨ ⟩ original small note. */
  vi: z.string(),
  en: z.string(),
  notes: z.array(z.string()),
  groups: z.array(ClauseGroup),
});
export type Passage = z.infer<typeof Passage>;

const Bi = { title: z.string(), sub: z.string().optional(), enLabel: z.string().optional(), enSub: z.string().optional() };
export const Year = z.object({ id: z.string(), label: z.string(), reign: z.string(), gz: z.string().optional(), jul: z.number().int().optional(), ...Bi });
export type Year = z.infer<typeof Year>;
export const Reign = z.object({ id: z.string(), zh: z.string(), vi: z.string(), sub: z.string(), en: z.string(), enSub: z.string() });
export type Reign = z.infer<typeof Reign>;

export const Chapter = z.object({
  id: z.string(),
  slug: z.string(),
  work: z.string(),
  section: z.string(),
  volume: z.number().int(),
  title: z.object({ zh: z.string(), vi: z.string(), en: z.string() }),
  span: z.object({ from: z.number(), to: z.number(), years: z.number() }),
  sources: z.object({ zh: z.string(), vi: z.string(), en: z.string() }),
  reigns: z.array(Reign),
  years: z.array(Year),
  passages: z.array(PassageId),
});
export type Chapter = z.infer<typeof Chapter>;

export const Discussion = z.object({
  id: z.string(), entry: PassageId, title: z.string(), kind: z.string(), status: z.string(), author: z.string(),
  ago: z.number(), quote: z.string().optional(), body: z.string(),
  replies: z.array(z.object({ author: z.string(), body: z.string(), ago: z.number() })).default([]),
  demo: z.boolean().optional(),
});
export type Discussion = z.infer<typeof Discussion>;

export const ParallelSources = z.record(PassageId, z.array(z.object({ t: z.string(), d: z.string() })));

// ---- entities (Toàn Thư entity database, schema v1, compiled by the entity bridge)
export const EntityType = z.enum(['person', 'place', 'polity', 'office', 'title', 'reign_era']);
const Names = z.object({ zh: z.string().optional(), vi: z.string().optional() });
export const WikiVi = z.object({
  title: z.string(), url: z.string().url(), extract: z.string().optional(), thumbnail: z.string().optional(),
  thumbnail_data_uri: z.string().optional(), image_attribution: z.string().optional(),
  revision: z.union([z.string(), z.number()]).optional(), retrieved_at: z.string().optional(), license: z.string().optional(),
});
export const Entity = z.object({
  id: z.string(),
  type: EntityType,
  subtype: z.string().optional(),
  names: Names,
  aliases: z.object({ zh: z.array(z.string()).default([]), vi: z.array(z.string()).default([]) }).default({ zh: [], vi: [] }),
  review_required: z.boolean().optional(),
  variants: z.array(z.object({ surface: z.string(), lang: z.string(), kind: z.string(), status: z.string(), evidence: z.string().optional() }).passthrough()).optional(),
  review: z.array(z.object({ review_id: z.string(), kind: z.string(), reason: z.string() }).passthrough()).optional(),
  occurrences: z.object({ zh: z.number(), vi: z.number(), total: z.number() }).optional(),
  external: z.object({ wikidata: z.string().optional(), wikipedia: z.object({ vi: WikiVi.optional() }).optional() }).optional(),
  wikipedia_status: z.string().optional(),
}).passthrough();
export type Entity = z.infer<typeof Entity>;

export const Relation = z.object({
  relation_id: z.string(), subject: z.string(), predicate: z.string(), object: z.string(),
  evidence: z.object({ zh: z.string().optional(), vi: z.string().optional() }).optional(),
  confidence: z.number().optional(),
});
export type Relation = z.infer<typeof Relation>;

export const PlacedMention = z.object({
  mentionId: z.string(),
  entityId: z.string(),
  entryId: PassageId,
  lang: z.enum(['zh', 'vi']),
  target: z.enum(['body', 'note']),
  noteIndex: z.number().int().optional(),
  text: z.string(),
  render: z.object({ start: z.number().int(), end: z.number().int(), coord: z.string() }),
  groupIndex: z.number().int().nullable(),
  reviewRequired: z.boolean(),
  context: z.tuple([z.string(), z.string()]),
}).passthrough();
export type PlacedMention = z.infer<typeof PlacedMention>;

export const ReaderEntities = z.object({
  schema: z.string().optional(),
  enrichment: z.object({ status: z.string().optional(), generated_at: z.string().optional(), note: z.string().optional() }).passthrough(),
  entities: z.record(z.string(), Entity),
  relations: z.array(Relation),
  mentions: z.array(PlacedMention),
}).passthrough();
export type ReaderEntities = z.infer<typeof ReaderEntities>;

// ---- work navigation tree
export type NavNode = { t: string; chapter?: string; anchor?: string; kids?: NavNode[] };
export const NavNode: z.ZodType<NavNode> = z.lazy(() =>
  z.object({ t: z.string(), chapter: z.string().optional(), anchor: z.string().optional(), kids: z.array(NavNode).optional() }),
);
export const Work = z.object({
  id: z.string(),
  title: z.object({ zh: z.string(), vi: z.string(), en: z.string() }),
  note: z.string().optional(),
  sections: z.array(z.object({ t: z.string(), items: z.array(NavNode) })),
  en: z.record(z.string(), z.string()),
});
export type Work = z.infer<typeof Work>;
