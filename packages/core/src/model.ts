// Render model for one passage, computed at build time.
//
// This is a port of the prototype's runtime DOM passes (zhHtml / viHtml, prepareAlign,
// prepareEntities) into pure functions. The prototype wrapped text nodes in the browser; here the
// same offsets are resolved into a tree that React renders as static HTML. The resulting markup
// (class names, data attributes, nesting) matches the prototype so its stylesheet applies as is.
import type { Passage, PlacedMention } from './schema';

export const HAN = /[㐀-鿿豈-﫿\u{20000}-\u{2FFFF}]/u;
const sqz = (s: string) => s.normalize('NFC').replace(/\s+/g, '');

export type Lexicon = { hanviet: Record<string, string>; variants: Record<string, string> };

/** Entity mark on a piece of text (one mention may span several pieces). */
export type EntMark = { m: number; ent: string; rv: boolean; first: boolean; last: boolean; label?: string };
/** Clause mark: g = clause group, r = range id inside the passage (for pair texts). */
export type ClMark = { g: number; r: number; side: 'v' | 'z'; sf: boolean; sl: boolean };

// ------------------------------------------------------------------ Chinese
export type ZhUnit = {
  kind: 'hz' | 'zp';
  c: string;            // character as printed in the source
  n?: string;           // normalized variant form, if any
  hv?: string;          // Hán-Việt reading
  flag: boolean;        // ⚑ doubtful character
  cl?: ClMark;
  ent?: EntMark;
};
export type ZhNode = { t: 'u'; u: ZhUnit } | { t: 'note'; units: ZhUnit[] };

export function zhUnits(str: string, lex: Lexicon): { nodes: ZhNode[]; units: ZhUnit[] } {
  const nodes: ZhNode[] = [];
  const units: ZhUnit[] = [];
  let flag = false;
  let note: ZhUnit[] | null = null;
  for (const ch of Array.from(str)) {
    if (ch === '⚑') { flag = true; continue; }
    if (ch === '〈') { note = []; nodes.push({ t: 'note', units: note }); continue; }
    if (ch === '〉') { note = null; continue; }
    let u: ZhUnit;
    if (HAN.test(ch)) {
      u = { kind: 'hz', c: ch, n: lex.variants[ch], hv: lex.hanviet[ch], flag };
      flag = false;
    } else u = { kind: 'zp', c: ch, flag: false };
    units.push(u);
    if (note) note.push(u); else nodes.push({ t: 'u', u });
  }
  return { nodes, units };
}

// ------------------------------------------------------------------ Vietnamese / English
export type Run = { text: string; cl?: ClMark; ent?: EntMark };
export type ViNode =
  | { t: 'text'; text: string; start: number; runs?: Run[] }
  | { t: 'span'; cls: 'ed' | 'on' | 'br'; children: ViNode[] }
  | { t: 'fo'; folio: string }
  | { t: 'fr'; n: number };

/** Parse the Vietnamese markup into a tree; text leaves carry their offset in the visible text. */
export function viTree(s: string): { nodes: ViNode[]; text: string } {
  const root: ViNode[] = [];
  const stack: ViNode[][] = [root];
  const top = () => stack[stack.length - 1];
  let text = '';
  const addText = (t: string, into: ViNode[] = top()) => {
    if (!t) return;
    into.push({ t: 'text', text: t, start: text.length });
    text += t;
  };
  const open = (cls: 'ed' | 'on', br: string) => {
    const node: ViNode = { t: 'span', cls, children: [] };
    top().push(node);
    stack.push(node.children);
    const b: ViNode = { t: 'span', cls: 'br', children: [] };
    top().push(b);
    addText(br, b.children);
  };
  const close = (br: string) => {
    const b: ViNode = { t: 'span', cls: 'br', children: [] };
    top().push(b);
    addText(br, b.children);
    if (stack.length > 1) stack.pop();
  };
  for (const p of s.split(/(⟦|⟧|⟨|⟩|\|\d+[ab]\||\{n\d+\})/)) {
    if (p === '⟦') open('ed', '[');
    else if (p === '⟧') close(']');
    else if (p === '⟨') open('on', '(');
    else if (p === '⟩') close(')');
    else if (/^\|\d+[ab]\|$/.test(p)) top().push({ t: 'fo', folio: p.slice(1, -1) });
    else if (/^\{n\d+\}$/.test(p)) top().push({ t: 'fr', n: Number(p.slice(2, -1)) });
    else addText(p);
  }
  return { nodes: root, text };
}

function leaves(nodes: ViNode[], out: Extract<ViNode, { t: 'text' }>[] = []) {
  for (const n of nodes) {
    if (n.t === 'text') out.push(n);
    else if (n.t === 'span') leaves(n.children, out);
  }
  return out;
}

type Range = { a: number; b: number; g: number; r: number };
type MRange = { a: number; b: number; mark: Omit<EntMark, 'first' | 'last'> };

/** Split text leaves at clause and mention boundaries and attach marks (sf/sl, e1/e2 like the prototype). */
function annotate(nodes: ViNode[], ranges: Range[], ments: MRange[], side: 'v') {
  const ls = leaves(nodes);
  type P = Run & { leaf: number };
  const pieces: P[] = [];
  ls.forEach((leaf, li) => {
    const s0 = leaf.start, e0 = s0 + leaf.text.length;
    const cuts = new Set([s0, e0]);
    for (const r of ranges) for (const x of [r.a, r.b]) if (x > s0 && x < e0) cuts.add(x);
    for (const m of ments) for (const x of [m.a, m.b]) if (x > s0 && x < e0) cuts.add(x);
    const cs = [...cuts].sort((p, q) => p - q);
    leaf.runs = [];
    for (let i = 0; i + 1 < cs.length; i++) {
      const a = cs[i], b = cs[i + 1];
      const r = ranges.find((x) => x.a <= a && b <= x.b);
      const m = ments.find((x) => x.a <= a && b <= x.b);
      const run: P = { text: leaf.text.slice(a - s0, b - s0), leaf: li };
      if (r) run.cl = { g: r.g, r: r.r, side, sf: false, sl: false };
      if (m) run.ent = { ...m.mark, first: false, last: false };
      pieces.push(run);
      leaf.runs.push(run);
    }
  });
  // clause pieces = leaf ∩ range (consecutive runs in one leaf share one span)
  for (const r of ranges) {
    const ps = pieces.filter((p) => p.cl && p.cl.r === r.r);
    if (!ps.length) continue;
    ps[0].cl!.sf = true;
    const lastLeaf = ps[ps.length - 1].leaf;
    ps.filter((p) => p.leaf === lastLeaf).forEach((p) => (p.cl!.sl = true));
    ps.filter((p) => p.leaf === ps[0].leaf).forEach((p) => (p.cl!.sf = true));
  }
  for (const m of ments) {
    const ps = pieces.filter((p) => p.ent && p.ent.m === m.mark.m);
    if (!ps.length) continue;
    ps[0].ent!.first = true;
    ps[ps.length - 1].ent!.last = true;
  }
  for (const p of pieces) delete (p as Partial<P>).leaf;
}

// ------------------------------------------------------------------ alignment (port of prepareAlign)
export type PairTexts = { v: string[]; z: string[] };

function alignGroups(p: Passage, lang: 'vi' | 'en', text: string, zh: ZhUnit[] | null, warn: (m: string) => void) {
  const strip: string[] = [];
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) { strip.push(text[i]); map.push(i); }
  const vs = strip.join('');
  let zt = '';
  const u2e: number[] = [];
  (zh || []).forEach((u, i) => {
    const c = u.kind === 'hz' ? (u.n || u.c) : u.c;
    for (let k = 0; k < c.length; k++) u2e.push(i);
    zt += c;
  });
  const normZh = (s: string) => Array.from(s).map((c) => (zh && zhVar[c]) || c).join('');
  const cur = { v: 0, z: 0 };
  const vr: Range[] = [];
  const zr: { ea: number; eb: number; g: number }[] = [];
  let rid = 0;
  p.groups.forEach((g, gi) => {
    for (const t of lang === 'en' ? g.en : g.vi) {
      const q = t.normalize('NFC').replace(/\s+/g, '');
      if (!q) continue;
      let i = vs.indexOf(q, cur.v);
      if (i < 0) i = vs.indexOf(q);
      if (i < 0) { warn(`align miss (${lang}) ${p.id} ${t}`); continue; }
      cur.v = i + q.length;
      vr.push({ a: map[i], b: map[i + q.length - 1] + 1, g: gi, r: rid++ });
    }
    if (!zh) return;
    for (const t of g.zh) {
      const q = normZh(t.replace(/[〈〉⚑\s]/g, ''));
      if (!q) continue;
      let i = zt.indexOf(q, cur.z);
      if (i < 0) i = zt.indexOf(q);
      if (i < 0) { warn(`align miss (zh) ${p.id} ${t}`); continue; }
      cur.z = i + q.length;
      zr.push({ ea: u2e[i], eb: u2e[i + q.length - 1], g: gi });
    }
  });
  return { vr, zr };
}
let zhVar: Record<string, string> = {};

// ------------------------------------------------------------------ passage model
export type NoteModel = { n: number; nodes: ViNode[] };
export type PassageModel = {
  id: string;
  zh: ZhNode[] | null;
  vi: ViNode[];
  en: ViNode[];
  notes: NoteModel[];
  stats: { applied: number; skipped: string[] };
};

export type MentionRef = { i: number; m: PlacedMention; label: string };

export function buildPassage(p: Passage, lex: Lexicon, mentions: MentionRef[], warn: (m: string) => void = () => {}): PassageModel {
  zhVar = lex.variants;
  const stats = { applied: 0, skipped: [] as string[] };
  const zhm = p.zh ? zhUnits(p.zh, lex) : null;

  const vi = viTree(p.vi);
  const en = viTree(p.en);
  // Chinese clause marks come from the Vietnamese alignment pass (as in the prototype's VI mode);
  // the English pass only provides English ranges.
  // as in the prototype, clauses are aligned only when the passage has Chinese text and groups
  const aligned = !!(zhm && p.groups.length);
  const none = { vr: [] as Range[], zr: [] as { ea: number; eb: number; g: number }[] };
  const av = aligned ? alignGroups(p, 'vi', vi.text, zhm!.units, warn) : none;
  const ae = aligned ? alignGroups(p, 'en', en.text, null, warn) : none;
  if (zhm) {
    for (const r of av.zr) for (let k = r.ea; k <= r.eb; k++) {
      zhm.units[k].cl = { g: r.g, r: -1, side: 'z', sf: k === r.ea, sl: k === r.eb };
    }
  }

  const mark = (x: MentionRef) => ({ m: x.i, ent: x.m.entityId, rv: x.m.reviewRequired, label: x.label });
  // Chinese mentions: element index range
  for (const x of mentions.filter((x) => x.m.lang === 'zh')) {
    const seg = zhm ? zhm.units.slice(x.m.render.start, x.m.render.end) : [];
    if (!zhm || seg.length !== x.m.render.end - x.m.render.start || sqz(seg.map((u) => u.c).join('')) !== sqz(x.m.text)) {
      stats.skipped.push(x.m.mentionId);
      continue;
    }
    seg.forEach((u, k) => (u.ent = { ...mark(x), first: k === 0, last: k === seg.length - 1 }));
    stats.applied++;
  }
  // Vietnamese body mentions: offsets in the visible text
  const vb: MRange[] = [];
  for (const x of mentions.filter((x) => x.m.lang === 'vi' && x.m.target === 'body')) {
    if (sqz(vi.text.slice(x.m.render.start, x.m.render.end)) !== sqz(x.m.text)) { stats.skipped.push(x.m.mentionId); continue; }
    vb.push({ a: x.m.render.start, b: x.m.render.end, mark: mark(x) });
    stats.applied++;
  }
  annotate(vi.nodes, av.vr, vb, 'v');
  annotate(en.nodes, ae.vr, [], 'v');

  const notes: NoteModel[] = p.notes.map((t, ni) => {
    const nodes: ViNode[] = [{ t: 'text', text: t, start: 0 }];
    const ms: MRange[] = [];
    for (const x of mentions.filter((x) => x.m.target === 'note' && x.m.noteIndex === ni)) {
      if (sqz(t.slice(x.m.render.start, x.m.render.end)) !== sqz(x.m.text)) { stats.skipped.push(x.m.mentionId); continue; }
      ms.push({ a: x.m.render.start, b: x.m.render.end, mark: mark(x) });
      stats.applied++;
    }
    annotate(nodes, [], ms, 'v');
    return { n: ni + 1, nodes };
  });
  for (const id of stats.skipped) warn(`entity mention not applied: ${p.id} ${id}`);

  return { id: p.id, zh: zhm ? zhm.nodes : null, vi: vi.nodes, en: en.nodes, notes, stats };
}

/** Plain text versions used for search and the table of contents (same as the prototype). */
export const plainVi = (s: string) =>
  s.replace(/\{n\d+\}|\|\d+[ab]\|/g, '').replace(/[⟦⟨]/g, '[').replace(/[⟧⟩]/g, ']').replace(/\s+/g, ' ').trim();
export const plainZh = (s: string) => s.replace(/[⚑〈〉]/g, '');
