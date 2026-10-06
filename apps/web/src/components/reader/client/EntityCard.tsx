'use client';
// Entity card (V4 design): Overview / In Toàn Thư / Relations / Occurrences / Links.
// Everything shown comes from the entity database; Wikipedia is labelled as an external source.
import type { ReactNode } from 'react';
import type { Entity, Relation } from '@dvsktt/core';
import type { EntBundle } from '@/lib/reader/boot';
import * as I from '../icons';

export type CardTab = 'ov' | 'tt' | 'rel' | 'occ' | 'lk';
export type CardState = { id: string; pinned: boolean; anchor: number | null; hist: string[]; tab: CardTab };

const WIKI_TYPES: Record<string, 1> = { person: 1, place: 1, polity: 1 };
const TYPE_L: Record<string, [string, string, string]> = {
  person: ['PERSON', 'Person', 'Nhân vật'], place: ['PLACE', 'Place', 'Địa danh'], polity: ['POLITY', 'Polity', 'Quốc hiệu, chính thể'],
  office: ['OFFICE', 'Office', 'Chức quan'], title: ['TITLE', 'Title', 'Tước hiệu, danh hiệu'], reign_era: ['REIGN ERA', 'Reign era', 'Niên hiệu'],
};
/** predicate: [label subject→object, label object→subject, colour] */
const PRED: Record<string, [string, string, string]> = {
  child_of: ['Child of', 'Parent of', 'blue'], held_office: ['Held office', 'Office held by', 'green'], held_title: ['Held title', 'Title held by', 'green'],
  jurisdiction: ['Jurisdiction over', 'Under jurisdiction of', 'slate'], controlled_place: ['Controlled', 'Controlled by', 'amber'], killed: ['Killed', 'Killed by', 'red'],
  founded_polity: ['Founded', 'Founded by', 'orange'], capital_at: ['Capital', 'Capital of', 'purple'],
};
export const entName = (e?: Pick<Entity, 'names' | 'id'>) => (e ? e.names.vi || e.names.zh || e.id : '');
const Z = ({ children }: { children: ReactNode }) => <span className="z" lang="zh-Hant">{children}</span>;

export type CardIndex = {
  occ: Record<string, number[]>;        // entity id -> mention indexes
  out: Record<string, Relation[]>;
  inn: Record<string, Relation[]>;
};
export function indexBundle(b: EntBundle): CardIndex {
  const occ: CardIndex['occ'] = {}, out: CardIndex['out'] = {}, inn: CardIndex['inn'] = {};
  b.mentions.forEach((m, i) => (occ[m.e] = occ[m.e] || []).push(i));
  b.relations.forEach((r) => { (out[r.subject] = out[r.subject] || []).push(r); (inn[r.object] = inn[r.object] || []).push(r); });
  return { occ, out, inn };
}

function aliasesOf(e: Entity) {
  const a = e.aliases || { vi: [], zh: [] };
  return { vi: (a.vi || []).filter((x) => x !== e.names.vi), zh: (a.zh || []).filter((x) => x !== e.names.zh) };
}

type Props = {
  b: EntBundle; ix: CardIndex; st: CardState;
  onTab: (t: CardTab) => void; onGo: (id: string) => void; onBack: () => void; onClose: () => void;
  onOcc: (i: number) => void; onChar: (c: string, el: HTMLElement) => void;
};

export function CardBody({ b, ix, st, onTab, onGo, onBack, onClose, onOcc, onChar }: Props) {
  const e = b.entities[st.id];
  if (!e) return null;
  const al = aliasesOf(e), tl = TYPE_L[e.type] || [e.type.toUpperCase(), e.type, ''];
  const occ = ix.occ[e.id] || [];
  const o = e.occurrences || { total: 0, zh: 0, vi: 0 };
  const rows = [...(ix.out[e.id] || []).map((r) => ({ r, dir: 0 as const, other: r.object })), ...(ix.inn[e.id] || []).map((r) => ({ r, dir: 1 as const, other: r.subject }))];
  const tabs: [CardTab, string][] = [['ov', 'Overview'], ['tt', 'In Toàn Thư'], ['rel', 'Relations'], ['occ', `Occurrences (${occ.length})`], ['lk', 'Links']];
  const w = e.external?.wikipedia?.vi;

  const wikiBox = () => {
    if (!w) {
      if (!WIKI_TYPES[e.type]) return null;
      const st2 = b.enrichment.status, ws = e.wikipedia_status;
      const why = e.review_required ? 'The identification of this entity is itself under review in our database, so no external article is linked.'
        : (st2 === 'not_run' || ws === 'not_evaluated') ? 'The Wikipedia enrichment step has not been run for this build.'
        : ws === 'review' ? 'A candidate article did not pass every identity check (for example, it may be a modern place with the same name). It is waiting for human review.'
        : ws === 'no_match' ? 'No article with matching Chinese-name or historical evidence was found.'
        : 'No article passed the verification rules.';
      return (
        <section className="ec-box"><div className="ec-bh"><span style={{ color: 'var(--ink2)' }}><I.Wiki /></span><h3>Wikipedia (tiếng Việt)</h3></div>
          <div className="ec-none"><b>No Wikipedia article linked.</b><br />{why}</div></section>
      );
    }
    const img = w.thumbnail_data_uri || w.thumbnail;
    const t = w.extract || '';
    const d = (w.retrieved_at || '').slice(0, 10);
    return (
      <section className="ec-box">
        <div className="ec-bh"><span style={{ color: 'var(--eb)' }}><I.Wiki /></span><h3>Wikipedia (tiếng Việt)</h3>
          <a href={w.url} target="_blank" rel="noopener noreferrer" aria-label="Open on Wikipedia" style={{ display: 'inline-flex' }}><I.Ext /></a>
          <span className="sp" /><a href={w.url} target="_blank" rel="noopener noreferrer">View on Wikipedia →</a></div>
        <div className="ec-wk">
          {/* eslint-disable-next-line @next/next/no-img-element -- cached data: URI from the enrichment step */}
          {img ? <figure className="ec-fig"><img src={img} alt={w.title} loading="lazy" />{w.image_attribution ? <figcaption>{w.image_attribution}</figcaption> : null}</figure> : null}
          <div className="ec-wtxt">{t.startsWith(w.title) ? <><b>{w.title}</b>{t.slice(w.title.length)}</> : <><b>{w.title}</b>. {t}</>}</div>
        </div>
        <div className="ec-ext">External, modern source, not part of Đại Việt sử ký toàn thư. Text from Wikipedia (CC BY-SA 4.0){w.revision ? `, revision ${w.revision}` : ''}{d ? `, retrieved ${d}` : ''}.</div>
        <div className="ec-rm"><a href={w.url} target="_blank" rel="noopener noreferrer">Read more on Wikipedia →</a></div>
      </section>
    );
  };

  const reviewNotes = () => {
    const out: ReactNode[] = [];
    if (e.review_required) out.push('Identification under review in the V4 entity database (for example, a historical place equivalence that is not yet settled).');
    (e.variants || []).forEach((v) => out.push(<>Source form <b>{v.surface}</b> ({v.lang}) is a {v.kind.replace(/_/g, ' ')}, status: {v.status}. It is not treated as an alias.{v.evidence ? ' ' + v.evidence : ''}</>));
    (e.review || []).forEach((r) => { if (r.kind !== 'entity_resolution' || !e.review_required) out.push(`Review ${r.review_id}: ${r.reason}`); });
    return out.length ? <div className="ec-note">{out.map((x, i) => <span key={i}>{i ? <br /> : null}{x}</span>)}</div> : null;
  };

  const ttBox = (full: boolean) => {
    const zhs = [e.names.zh, ...al.zh].filter(Boolean) as string[], vis = [e.names.vi, ...al.vi].filter(Boolean) as string[];
    return (
      <section className="ec-box tt"><div className="ec-bh"><I.Book /><h3>In Đại Việt sử ký toàn thư</h3></div>
        <dl className="ec-dl">
          <dt>Names</dt><dd>{zhs.length ? <div className="z" lang="zh-Hant">{zhs.join(' · ')}</div> : null}{vis.length ? <div className="v">{vis.join(' · ')}</div> : null}</dd>
          <dt>Type</dt><dd>{tl[1]}{tl[2] ? <> <span style={{ color: 'var(--ink2)' }}>({tl[2]})</span></> : null}</dd>
          <dt>Appears in this text</dt>
          <dd className="ap"><span><b>{o.total} {o.total === 1 ? 'time' : 'times'}</b> in Kỷ nhà Đinh{o.total ? <> <span style={{ color: 'var(--ink2)' }}>(中文 {o.zh} · Việt {o.vi})</span></> : null}</span>
            {o.total ? <button className="ec-btn" onClick={() => onTab('occ')}>View all occurrences →</button> : null}</dd>
          {full ? <><dt>Entity ID</dt><dd><code>{e.id}</code></dd></> : null}
        </dl>
        {reviewNotes()}
      </section>
    );
  };

  const relLi = (x: (typeof rows)[number], full: boolean, k: number) => {
    const p = PRED[x.r.predicate] || [x.r.predicate, x.r.predicate + ' (inverse)', 'slate'];
    const t = b.entities[x.other];
    const ev = x.r.evidence || {};
    const evTxt = `${ev.zh ? '原文 ' + ev.zh : ''}${ev.zh && ev.vi ? ' · ' : ''}${ev.vi ? 'Bản dịch: ' + ev.vi : ''}`;
    return (
      <li key={k} title={evTxt}>
        <span className={`ec-pill p-${p[2]}`}>{p[x.dir]}</span><span className="ec-arr" aria-hidden="true">→</span>
        <button className="ec-tgt" disabled={!t} onClick={() => t && onGo(x.other)}>{t ? <>{entName(t)}{t.names.zh ? <> (<Z>{t.names.zh}</Z>)</> : null}</> : x.other}</button>
        <span className="ec-chip">{t ? t.type.replace('_', ' ') : '?'}</span>
        {full ? <div className="ev">{ev.zh ? <Z>{ev.zh}</Z> : null}{ev.zh && ev.vi ? ' · ' : ''}{ev.vi || ''}{x.r.confidence != null ? ` · confidence ${x.r.confidence}` : ''}</div> : null}
      </li>
    );
  };
  const relBox = (full: boolean) => {
    if (!rows.length && !full) return null;
    const lim = full ? rows.length : 6;
    return (
      <section className="ec-box rl"><div className="ec-bh"><I.RelIcon /><h3>Relations <small>(in this text)</small></h3>
        {!full && rows.length > lim ? <><span className="sp" /><button className="ec-more" onClick={() => onTab('rel')}>All {rows.length} →</button></> : null}</div>
        {rows.length ? <ul className="ec-rels">{rows.slice(0, lim).map((x, k) => relLi(x, full, k))}</ul> : <div className="ec-none">No relations recorded for this entity in the V4 relation data.</div>}
      </section>
    );
  };
  const occPane = () => {
    if (!occ.length) return <p className="ec-sum">No occurrences of this entity were placed in the Reader text.</p>;
    return (
      <>
        <p className="ec-sum">{o.total} occurrences in this Reader (中文 {o.zh} · Việt {o.vi}), counted from the V4 mention data. All names of the entity count together.</p>
        <ul className="ec-occ">
          {occ.map((i) => {
            const m = b.mentions[i], z = m.l === 'zh';
            return (
              <li key={i}><button data-ent-occ={i} onClick={() => onOcc(i)}>
                <span className="id">{m.en}</span><span className="lg">{z ? 'ZH' : 'VI'}</span>
                <span className={`cx${z ? ' z' : ''}`} lang={z ? 'zh-Hant' : undefined}>{m.c[0] ? '…' + m.c[0] : ''}<b>{m.t}</b>{m.c[1] ? m.c[1] + '…' : ''}</span>
                {m.tg === 'note' || m.rv ? <span className="sub">{m.tg === 'note' ? `In footnote ${(m.n ?? 0) + 1}` : ''}{m.tg === 'note' && m.rv ? ' · ' : ''}{m.rv ? 'identification under review' : ''}</span> : null}
              </button></li>
            );
          })}
        </ul>
      </>
    );
  };
  const linksPane = () => (
    <ul className="ec-links">
      {w ? <li>Wikipedia (tiếng Việt): <a href={w.url} target="_blank" rel="noopener noreferrer">{w.title} ↗</a></li> : null}
      {e.external?.wikidata ? <li>Wikidata: <a href={`https://www.wikidata.org/wiki/${e.external.wikidata}`} target="_blank" rel="noopener noreferrer">{e.external.wikidata} ↗</a></li> : null}
      {!w && WIKI_TYPES[e.type] ? <li>No Wikipedia article linked.</li> : null}
      <li>Entity ID: <code>{e.id}</code></li>
      <li>Identity, names, relations and occurrences come from the V4 Toàn Thư entity database (Schema v1). Wikipedia and Wikidata are external modern references.</li>
    </ul>
  );

  const prev = st.hist.length ? b.entities[st.hist[st.hist.length - 1]] : undefined;
  const aka: ReactNode[] = [...al.vi, ...al.zh.map((z, i) => <Z key={'z' + i}>{z}</Z>)];
  return (
    <>
      <div className="ec-h">
        <div className="ec-top">
          {st.hist.length ? <button className="ec-back" onClick={onBack} aria-label={`Back to ${entName(prev)}`} title="Back">←</button> : null}
          <div className="ec-names">
            <h2 className="ec-vi" id="ecT">{e.names.vi || e.names.zh || e.id}</h2>
            {e.names.vi && e.names.zh ? (
              <div className="ec-zh" lang="zh-Hant">
                {Array.from(e.names.zh).map((ch, i) => <button key={i} data-c={ch} title={`Tra từ điển ${ch}`} onClick={(ev) => onChar(ch, ev.currentTarget)}>{ch}</button>)}
              </div>
            ) : null}
          </div>
          <span className="ec-type">{tl[0]}</span>
          <button className="ec-x" onClick={onClose} aria-label="Close" title="Close (Esc)">×</button>
        </div>
        {aka.length ? <div className="ec-aka"><span>Also known as:</span> {aka.map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</div> : null}
        {e.review_required ? <span className="ec-flag">Identification under review</span> : null}
        <nav className="ec-tabs" role="tablist">
          {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={st.tab === k} onClick={() => onTab(k)}>{t}</button>)}
        </nav>
      </div>
      <div className="ec-b" role="tabpanel">
        {st.tab === 'ov' ? <>{wikiBox()}{ttBox(false)}{relBox(false)}</> : st.tab === 'tt' ? ttBox(true) : st.tab === 'rel' ? relBox(true) : st.tab === 'occ' ? occPane() : linksPane()}
      </div>
    </>
  );
}
