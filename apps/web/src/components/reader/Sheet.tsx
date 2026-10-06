// The reading sheet: every passage of a chapter, rendered on the server at build time.
import type { LoadedChapter } from '@/lib/content/load';
import { buildPassage, type Lexicon, type MentionRef } from '@dvsktt/core';
import { ViNodes, ZhText } from './PassageText';
import * as I from './icons';

const Bi = ({ vi, en }: { vi: string; en: string }) => <><span data-tl="vi">{vi}</span><span data-tl="en">{en}</span></>;

export function buildSheet(data: LoadedChapter, lex: Lexicon) {
  const { entities } = data;
  const byEntry = new Map<string, MentionRef[]>();
  entities.mentions.forEach((m, i) => {
    const e = entities.entities[m.entityId];
    const name = e ? (e.names.vi || e.names.zh || e.id) : m.entityId;
    const ref = { i, m, label: `${m.text}: ${name}${m.reviewRequired ? ' (identification under review)' : ''}` };
    byEntry.set(m.entryId, [...(byEntry.get(m.entryId) || []), ref]);
  });
  const warnings: string[] = [];
  const models = data.passages.map((p) => buildPassage(p, lex, byEntry.get(p.id) || [], (w) => warnings.push(w)));
  const applied = models.reduce((a, m) => a + m.stats.applied, 0);
  return { models, warnings, applied };
}

export function Sheet({ data, models }: { data: LoadedChapter; models: ReturnType<typeof buildSheet>['models'] }) {
  const { chapter, passages, discussions, parallel } = data;
  const YM = Object.fromEntries(chapter.years.map((y) => [y.id, y]));
  const RM = Object.fromEntries(chapter.reigns.map((r) => [r.id, r]));
  const out: React.ReactNode[] = [];
  let lastR: string | null = null, lastY: string | null = null;
  passages.forEach((e, i) => {
    const m = models[i];
    if (e.reign !== lastR) {
      const r = RM[e.reign];
      out.push(
        <div key={`R-${r.id}`} className="rb" id={`R-${r.id}`} data-spy="" data-year={`${r.id}0`} data-reign={r.id}>
          <span className="rbz">{r.zh}</span><span className="rbv"><Bi vi={r.vi} en={r.en} /></span><span className="rbs"><Bi vi={r.sub} en={r.enSub} /></span>
        </div>,
      );
      lastR = e.reign; lastY = null;
    }
    if (e.year !== lastY) {
      const y = YM[e.year];
      if (y.gz) out.push(
        <header key={`Y-${y.id}`} className="yh" id={`Y-${y.id}`} data-spy="" data-year={y.id} data-reign={y.reign}>
          <span className="gz" aria-hidden="true">{y.gz}</span><h2>{y.title}</h2><span className="jl">[{y.jul}]</span>
          <span className="ys"><Bi vi={y.sub || ''} en={y.enSub || y.sub || ''} /></span>
        </header>,
      );
      lastY = e.year;
    }
    const n = discussions.filter((t) => t.entry === e.id).length;
    out.push(
      <article key={e.id} className={`entry t-${e.type}${e.type === 'comment' ? ' comment' : ''}`} id={e.id} data-id={e.id} data-year={e.year} data-reign={e.reign}>
        <div className={`etools${n ? ' has-n' : ''}`} data-eid={e.id}>
          <button className="b" data-act="save" aria-pressed="false" title="Lưu đoạn này" aria-label="Lưu đoạn này"><I.Star /></button>
          <button className="b" data-act="cite" title="Trích dẫn" aria-label="Trích dẫn"><I.Quote /></button>
          <button className="b" data-act="link" title="Sao chép liên kết" aria-label="Sao chép liên kết"><I.Link /></button>
          {parallel[e.id] ? <button className="b" data-act="src" title="Nguồn song song" aria-label="Nguồn song song"><I.Swap /></button> : null}
          <button className="b more" data-act="more" title="Thao tác" aria-label="Thao tác khác"><I.More /></button>
          <button className="b fbtn" data-act="forum" title="Góp ý sửa" aria-label="Góp ý sửa"><I.Chat /><span className="badge" hidden={!n}>{n}</span></button>
        </div>
        <div className="zhc">
          {m.zh ? <ZhText nodes={m.zh} /> : (
            <div className="zh missing"><span className="gap"><Bi vi="Chưa có nguyên văn Hán cho đoạn này" en="No Chinese text for this passage yet" /></span></div>
          )}
        </div>
        <div className="vic">
          <div className="vi" lang="vi" data-tl="vi"><ViNodes nodes={m.vi} /></div>
          <div className="vi" lang="en" data-tl="en"><ViNodes nodes={m.en} /></div>
          {m.notes.length ? (
            <ol className="fns" data-tl="vi">
              {m.notes.map((nt) => (
                <li key={nt.n} id={`${e.id}-fn${nt.n}`}><span className="fnn">{nt.n}</span><span><ViNodes nodes={nt.nodes} /></span></li>
              ))}
            </ol>
          ) : null}
        </div>
      </article>,
    );
  });
  return <>{out}</>;
}
