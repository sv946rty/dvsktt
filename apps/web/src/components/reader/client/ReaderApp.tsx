'use client';
// Reader chrome and behaviour around the server-rendered sheet.
//
// Panels, popovers and the entity card are React state. Hover feedback on the text (clause
// pairs, entity underlines) toggles classes directly on the static sheet through delegated
// listeners, as the prototype did, so moving the pointer never re-renders 44 passages.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Boot, EntBundle, SearchDoc } from '@/lib/reader/boot';
import type { NavNode } from '@dvsktt/core';
import { applyPrefs, DEFAULT_PREFS, loadPrefs, savePrefs, SIZES, type Prefs } from '@/lib/prefs/prefs';
import * as I from '../icons';
import { CardBody, entName, indexBundle, type CardState, type CardTab } from './EntityCard';
import { lastAct, loadForum, saveForum, stCls, type Thread } from './forum';
import { $, $$, copyText, HAN, isTouch, LS, norm, placeBelow, rectOf, reduceMotion, rel, unionRect, type Rect } from './util';

type Dlg = { title: string; body: ReactNode; actions?: { t: string; pri?: boolean; fn?: () => void }[] } | null;
type ForumView = { eid: string; view: 'list' | 'new' | 'thread'; tid?: string } | null;

const SWITCHES: [keyof Prefs, string, string, string, string][] = [
  ['al', 'Sáng cả câu tương ứng', 'Rê chuột (hoặc chạm) vào một câu để sáng câu tương ứng ở bên kia', 'Highlight matching clause', 'Hover (or tap) a clause to light up its counterpart'],
  ['ruby', 'Âm Hán-Việt trên chữ Hán', 'Chỉ có cho một phần chữ trong bản thử', 'Sino-Vietnamese readings', 'Available for some characters only'],
  ['norm', 'Chuẩn hóa chữ dị thể', 'Ví dụ 䧺 hiện thành 雄', 'Normalize variant characters', 'e.g. 䧺 shown as 雄'],
  ['vert', 'Chữ Hán đọc dọc', 'Chiều đọc cổ truyền', 'Vertical Chinese', 'Traditional reading direction'],
  ['hideEd', 'Ẩn chữ dịch giả thêm vào', 'Phần trong [ ]', 'Hide translator insertions', 'Text in [ ]'],
  ['hideOn', 'Ẩn chú nhỏ của nguyên văn', 'Phần trong ( )', 'Hide original small notes', 'Text in ( )'],
];

// hover/close timers (one reader per page)
const TIMERS: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
const clear = (k: string) => clearTimeout(TIMERS[k]);
const later = (k: string, fn: () => void, ms: number) => { clear(k); TIMERS[k] = setTimeout(fn, ms); };

type ForumProps = {
  forum: NonNullable<ForumView>; setForum: (f: ForumView) => void; threads: Thread[]; setThreads: (t: Thread[]) => void;
  threadsFor: (eid: string) => Thread[]; entryLabel: (id: string) => string; EM: Record<string, { vi: string }>;
  toast: (m: string) => void; threadRow: (x: Thread) => ReactNode;
};
function ForumBody({ forum, setForum, threads, setThreads, threadsFor, entryLabel, EM, toast, threadRow }: ForumProps) {
    const [kind, setKind] = useState('Bản Hán'); const [title, setTitle] = useState(''); const [quote, setQuote] = useState(''); const [body, setBody] = useState(''); const [reply, setReply] = useState('');
    const eid = forum.eid;
    if (forum.view === 'list') {
      const list = threadsFor(eid).sort((a, b) => lastAct(b) - lastAct(a));
      return (
        <>
          <p className="legend" style={{ margin: '0 0 8px' }}><b>{entryLabel(eid)}</b><br />{EM[eid].vi.slice(0, 90)}…</p>
          <p className="legend" style={{ margin: '0 0 8px' }}>Chỗ để báo chữ Hán, bản dịch hoặc chú thích có thể sai ở đoạn này, và để mọi người cùng thảo luận.</p>
          {list.length ? list.map(threadRow) : <div className="empty">Chưa có góp ý nào. Hãy là người đầu tiên.</div>}
          <div style={{ marginTop: 14 }}><button className="btn pri" onClick={() => setForum({ eid, view: 'new' })}>＋ Báo lỗi / góp ý cho đoạn này</button></div>
        </>
      );
    }
    if (forum.view === 'new') {
      return (
        <>
          <p className="legend" style={{ margin: 0 }}><b>{entryLabel(eid)}</b></p>
          <p className="legend" style={{ margin: '6px 0 0' }}>Dùng khi bạn thấy chữ Hán, bản dịch hoặc chú thích của đoạn này có thể sai hoặc cần bàn thêm. Góp ý của bạn thành một chuỗi thảo luận để mọi người cùng trả lời.</p>
          <label className="field"><span>Loại góp ý</span><select value={kind} onChange={(e) => setKind(e.target.value)}>{['Bản Hán', 'Bản dịch', 'Chú thích', 'Nối câu Việt–Hán', 'Khác'].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="field"><span>Tiêu đề</span><input id="nTitle" maxLength={120} placeholder="Ví dụ: chữ này nên là…" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="field"><span>Đoạn nghi vấn (có thể dán từ văn bản)</span><input maxLength={200} value={quote} onChange={(e) => setQuote(e.target.value)} /></label>
          <label className="field"><span>Nội dung và nguồn tham khảo</span><textarea value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <button className="btn pri" onClick={() => {
            if (!title.trim() || !body.trim()) { toast('Cần nhập tiêu đề và nội dung'); return; }
            const n = [...threads, { id: 'u' + Date.now().toString(36), entry: eid, title: title.trim(), kind, status: 'Đang thảo luận', author: 'Bạn', ts: Date.now(), quote: quote.trim(), body: body.trim(), replies: [] }];
            setThreads(n); saveForum(n); setForum({ eid, view: 'list' }); toast('Đã gửi góp ý');
          }}>Gửi góp ý</button>
          <p className="legend" style={{ marginTop: 12 }}>Bản thử: góp ý chỉ lưu trong trình duyệt này, chưa gửi lên máy chủ.</p>
        </>
      );
    }
    const th = threads.find((x) => x.id === forum.tid);
    if (!th) return null;
    return (
      <>
        <p className="legend" style={{ margin: '0 0 6px' }}><b>{entryLabel(th.entry)}</b></p>
        <h3 style={{ margin: '4px 0 6px', fontFamily: 'var(--vi)', fontSize: '1.2rem' }}>{th.title}</h3>
        <div className="post"><div className="meta"><b>{th.author}</b><span>{rel(th.ts)}</span><span>{th.kind || ''}</span><i className={`st ${stCls(th.status)}`}>{th.status}</i>{th.demo ? <span className="demo">ví dụ minh họa</span> : null}</div>
          {th.quote ? <div className="quoteb" lang="zh-Hant">{th.quote}</div> : null}<p>{th.body}</p></div>
        {th.replies.map((r, i) => <div key={i} className="post"><div className="meta"><b>{r.author}</b><span>{rel(r.ts)}</span></div><p>{r.body}</p></div>)}
        <label className="field"><span>Phản hồi của bạn</span><textarea placeholder="Thêm ý kiến, nguồn tham khảo…" value={reply} onChange={(e) => setReply(e.target.value)} /></label>
        <button className="btn pri" onClick={() => {
          if (!reply.trim()) { toast('Hãy nhập nội dung phản hồi'); return; }
          const n = threads.map((x) => (x.id === th.id ? { ...x, replies: [...x.replies, { author: 'Bạn', ts: Date.now(), body: reply.trim() }] } : x));
          setThreads(n); saveForum(n); setReply(''); toast('Đã gửi phản hồi');
        }}>Gửi phản hồi</button>
      </>
    );
  }

export function ReaderApp({ boot, children }: { boot: Boot; children: ReactNode }) {
  // ------------------------------------------------------------ preferences
  const [P, setP] = useState<Prefs>(DEFAULT_PREFS);
  // read browser preferences after hydration (the server always renders the defaults)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setP(loadPrefs()); }, []);
  const setPref = useCallback((patch: Partial<Prefs>) => {
    setP((p) => { const n = { ...p, ...patch }; savePrefs(n); applyPrefs(n); return n; });
  }, []);
  const t = useCallback((vi: string, en: string) => (P.lang === 'en' ? en : vi), [P.lang]);

  const YM = useMemo(() => Object.fromEntries(boot.years.map((y) => [y.id, y])), [boot.years]);
  const RM = useMemo(() => Object.fromEntries(boot.reigns.map((r) => [r.id, r])), [boot.reigns]);
  const EM = useMemo(() => Object.fromEntries(boot.entries.map((e) => [e.id, e])), [boot.entries]);
  const VAR = boot.lexicon.variants;
  const normZh = useCallback((s: string) => Array.from(s).map((c) => VAR[c] || c).join(''), [VAR]);
  const ylab = (y: (typeof boot.years)[number]) => (P.lang === 'en' && y.enLabel ? y.enLabel : y.label);
  const rname = (r: (typeof boot.reigns)[number]) => (P.lang === 'en' && r.en ? r.en : r.vi);
  const mt = (s: string) => (P.lang === 'en' && boot.work.en[s] ? boot.work.en[s] : s);

  // ------------------------------------------------------------ UI state
  const [cur, setCur] = useState({ year: boot.years[0].id, reign: boot.reigns[0].id });
  const [stripOpen, setStripOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [forum, setForum] = useState<ForumView>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [dd, setDd] = useState<{ i: number; r: Rect } | null>(null);
  const [ddOpenSub, setDdOpenSub] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchDoc[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [pop, setPop] = useState<{ c: string; r: Rect } | null>(null);
  const [fpop, setFpop] = useState<{ eid: string; r: Rect } | null>(null);
  const [pair, setPair] = useState<{ a: string; b: string; zhFirst: boolean } | null>(null);
  const [focus, setFocus] = useState(false);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [bundle, setBundle] = useState<EntBundle | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [sheetMode, setSheetMode] = useState(false);
  const ix = useMemo(() => (bundle ? indexBundle(bundle) : null), [bundle]);

  const popRef = useRef<HTMLDivElement>(null), fpopRef = useRef<HTMLDivElement>(null), ddRef = useRef<HTMLDivElement>(null), cardRef = useRef<HTMLElement>(null);
  const popSrc = useRef<Element | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after hydration
    setThreads(loadForum(boot.discussions));
    setSaved(new Set(LS.get<string[]>('dvsktt.saved.v1', [])));
  }, [boot.discussions]);

  const toast = useCallback((m: string) => { setToastMsg(m); later('toast', () => setToastMsg(null), 2600); }, []);

  // entity bundle: prefetched when the browser is idle, so the first hover is instant
  const bundleP = useRef<Promise<EntBundle> | null>(null);
  const getBundle = useCallback(() => {
    if (!bundleP.current) bundleP.current = fetch(`/data/${boot.slug}/entities.json`).then((r) => r.json()).then((b: EntBundle) => { setBundle(b); return b; });
    return bundleP.current;
  }, [boot.slug]);
  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback || ((f: () => void) => setTimeout(f, 200));
    ric(() => void getBundle());
  }, [getBundle]);

  // ------------------------------------------------------------ clause pairs
  const alCur = useRef<string | null>(null);
  const clearAl = useCallback(() => { $$('#sheet .cl.lit').forEach((x) => x.classList.remove('lit')); alCur.current = null; setPair(null); }, []);
  const lightGroup = useCallback((entry: HTMLElement, g: string, side: string) => {
    const key = entry.id + ':' + g;
    const tl = document.documentElement.classList.contains('tl-en') ? 'en' : 'vi';
    const vEls = $$(`.vi[data-tl="${tl}"] .cl[data-g="${g}"]`, entry), zEls = $$(`.zh .cl[data-g="${g}"]`, entry);
    if (!vEls.length || !zEls.length) return false;
    if (alCur.current === key) return true;
    clearAl(); alCur.current = key;
    [...vEls, ...zEls].forEach((x) => x.classList.add('lit'));
    if (isTouch()) {
      const vt: string[] = []; let lastR: string | null = null;
      vEls.forEach((x) => { if (x.dataset.r !== lastR) { vt.push(''); lastR = x.dataset.r!; } vt[vt.length - 1] += x.textContent; });
      const zt: string[] = [];
      zEls.forEach((x) => { if (x.classList.contains('sf') || !zt.length) zt.push(''); zt[zt.length - 1] += x.dataset.c; });
      setPair({ a: vt.map((s) => s.replace(/\s+/g, ' ')).join(' … '), b: zt.join(' … '), zhFirst: side === 'z' });
    }
    return true;
  }, [clearAl]);

  // ------------------------------------------------------------ closing everything
  const closeEnt = useCallback(() => {
    clear('eto'); clear('etc');
    setCard(null);
    $$('.ent.eon').forEach((x) => x.classList.remove('eon'));
  }, []);
  const closeAll = useCallback(() => {
    setSettingsOpen(false); setForum(null); setTocOpen(false); setDd(null);
    closeEnt(); setPop(null); setFpop(null); setShowResults(false);
  }, [closeEnt]);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id); if (!el) return;
    closeAll();
    el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    if (el.classList.contains('entry')) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }, [closeAll]);

  // ------------------------------------------------------------ character popover
  const showChar = useCallback((c: string, el: Element) => { popSrc.current = el; setPop({ c, r: rectOf(el) }); }, []);
  useLayoutEffect(() => { if (pop && popRef.current) placeBelow(popRef.current, pop.r); }, [pop]);
  useLayoutEffect(() => { if (fpop && fpopRef.current) placeBelow(fpopRef.current, fpop.r); }, [fpop, threads]);

  // ------------------------------------------------------------ entity card
  const cardS = useRef<CardState | null>(null);
  useLayoutEffect(() => { cardS.current = card; }, [card]);
  const openEnt = useCallback((id: string, anchor: HTMLElement | null, o: { pin?: boolean; push?: boolean; back?: boolean; tab?: CardTab } = {}) => {
    if (!o.pin && anchor) { const r = anchor.getBoundingClientRect(); if (!anchor.isConnected || r.bottom < 0 || r.top > innerHeight) return; }
    clear('eto'); clear('etc');
    void getBundle();
    const prev = cardS.current;
    const same = prev?.id === id;
    let hist = prev?.hist || [];
    if (o.push && prev && prev.id !== id) hist = [...hist, prev.id]; else if (!o.push && !o.back) hist = [];
    const pinned = o.pin ? true : same ? !!prev?.pinned : false;
    const a = anchor?.dataset?.m != null ? Number(anchor.dataset.m) : prev?.anchor ?? null;
    const tab = !same || o.tab || o.push || o.back ? o.tab || 'ov' : prev!.tab;
    setPop(null);
    setCard({ id, pinned, anchor: a, hist, tab });
    $$('.ent.eon').forEach((x) => x.classList.remove('eon'));
    if (a != null) $$(`.ent[data-m="${a}"]`).forEach((x) => x.classList.add('eon'));
    if (o.pin && !same) setTimeout(() => { const x = $<HTMLButtonElement>('#ecard .ec-x'); if (x && (isTouch() || innerWidth < 900)) x.focus({ preventScroll: true }); }, 30);
  }, [getBundle]);

  // card placement (prototype placeCard): beside the entity, never over it; bottom sheet on touch/narrow
  const placeCard = useCallback(() => {
    const c = cardRef.current, st = cardS.current; if (!c || !st) return;
    const sm = isTouch() || innerWidth < 900;
    setSheetMode(sm);
    if (sm) { c.style.left = c.style.top = ''; return; }
    const w = c.offsetWidth, h = c.offsetHeight, M = 12, G = 16;
    let r = st.anchor != null ? unionRect($$(`.ent[data-m="${st.anchor}"]`)) : null;
    if (!r || r.bottom < 0 || r.top > innerHeight) r = { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3 };
    let left: number, top: number | null;
    if (r.right + G + w <= innerWidth - M) { left = r.right + G; top = r.top - 48; }
    else if (r.left - G - w >= M) { left = r.left - G - w; top = r.top - 48; }
    else {
      left = Math.min(Math.max(M, r.left - 40), innerWidth - w - M);
      top = r.bottom + 10 + h <= innerHeight - M ? r.bottom + 10 : r.top - 10 - h >= M ? r.top - 10 - h : null;
      if (top === null) { top = M; left = (r.left + r.right) / 2 < innerWidth / 2 ? innerWidth - w - M : M; }
    }
    top = Math.max(M, Math.min(top, innerHeight - h - M));
    c.style.left = Math.round(left) + 'px'; c.style.top = Math.round(top) + 'px';
  }, []);
  useLayoutEffect(() => { if (card) placeCard(); }, [card, bundle, placeCard]);

  const goOcc = useCallback((mi: number) => {
    const m = bundle?.mentions[mi]; if (!m) return;
    closeEnt();
    if (m.l === 'vi' && P.lang === 'en') { setPref({ lang: 'vi' }); toast('Switched to the Vietnamese text to show this occurrence'); }
    if ((m.l === 'vi' && P.mode === 'zh') || (m.l === 'zh' && P.mode === 'vi')) setPref({ mode: 'both' });
    if (document.documentElement.classList.contains('is-focus') && isTouch()) setFocus(false);
    requestAnimationFrame(() => {
      const els = $$(`.ent[data-m="${mi}"]`).filter((x) => x.offsetParent !== null);
      if (!els.length) { scrollToId(m.en); return; }
      els[0].scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
      els.forEach((x) => { x.classList.remove('eflash'); void x.offsetWidth; x.classList.add('eflash'); });
      setTimeout(() => els.forEach((x) => x.classList.remove('eflash')), 2000);
    });
  }, [bundle, closeEnt, P.lang, P.mode, setPref, toast, scrollToId]);

  // ------------------------------------------------------------ search
  const searchP = useRef<Promise<SearchDoc[]> | null>(null);
  const runSearch = useCallback(async (raw: string) => {
    const qq = raw.trim(); if (!qq) { setShowResults(false); return; }
    if (!searchP.current) searchP.current = fetch(`/data/${boot.slug}/search.json`).then((r) => r.json());
    const docs = await searchP.current;
    setResults(docs); setShowResults(true);
  }, [boot.slug]);
  useEffect(() => { const k = setTimeout(() => { if (q.trim()) void runSearch(q); else setShowResults(false); }, 110); return () => clearTimeout(k); }, [q, runSearch]);

  // ------------------------------------------------------------ misc actions
  const setSize = (d: number) => { const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(P.rs) + d)); setPref({ rs: SIZES[i < 0 ? 1 : i] }); clearAl(); };
  const toggleTheme = () => { const eff = P.theme === 'auto' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : P.theme; setPref({ theme: eff === 'dark' ? 'light' : 'dark' }); };
  const setLang = (l: Prefs['lang']) => { clearAl(); setDd(null); setPref({ lang: l }); };
  const setMode = (m: Prefs['mode']) => { setPref({ mode: m }); clearAl(); };
  const doFocus = useCallback((on: boolean) => {
    document.documentElement.classList.toggle('is-focus', on); setFocus(on); closeAll(); clearAl();
    document.documentElement.classList.remove('hdr-hidden'); document.documentElement.style.setProperty('--hs', '');
    if (on) toast(t('Đọc tập trung. Bấm ✕ Thoát, Esc hoặc F để thoát.', 'Focus mode. Click ✕ Exit, or press Esc or F.'));
  }, [closeAll, clearAl, toast, t]);
  const entryUrl = (id: string) => location.href.split('#')[0] + '#' + id;
  const citation = (id: string) => {
    const e = EM[id], y = YM[e.year], r = RM[e.reign], d = new Date().toLocaleDateString('vi-VN');
    return `Ngô Sĩ Liên và các sử thần, Đại Việt sử ký toàn thư, Bản kỷ, quyển 1, ${boot.title.vi}, ${r.vi}, ${y.title}${y.jul ? ' [' + y.jul + ']' : ''}, tờ ${e.folio}. Bản dịch tiếng Việt: tr. ${e.pp}. Dữ liệu thử riêng tư. ${entryUrl(id)} (truy cập ${d}).`;
  };
  const entryLabel = (id: string) => { const e = EM[id], y = YM[e.year]; return `${y.title}${y.jul ? ' [' + y.jul + ']' : ''} · đoạn ${id}`; };
  const threadsFor = useCallback((eid: string) => threads.filter((x) => x.entry === eid), [threads]);
  const openForum = (eid: string, view: 'list' | 'new' | 'thread' = 'list', tid?: string) => {
    setFpop(null); clearAl(); setSettingsOpen(false); setForum({ eid, view, tid });
  };

  // keep the server-rendered toolbar badges and "saved" stars in sync with browser state
  useEffect(() => {
    $$('.etools').forEach((bar) => {
      const n = threads.filter((x) => x.entry === bar.dataset.eid).length;
      bar.classList.toggle('has-n', n > 0);
      const b = $('.badge', bar); if (b) { b.textContent = String(n); b.hidden = !n; }
      const s = $('[data-act="save"]', bar); if (s) s.setAttribute('aria-pressed', String(saved.has(bar.dataset.eid!)));
    });
  }, [threads, saved]);

  // ------------------------------------------------------------ scroll spy and header
  useEffect(() => {
    let spyEls = $$('[data-spy]'), lastY = 0, tick = false;
    const root = document.documentElement;
    const spy = () => {
      if (!spyEls.length) spyEls = $$('[data-spy]');
      if (!spyEls.length) return;
      const lim = (parseFloat(getComputedStyle(root).getPropertyValue('--hs')) || 0) + 110;
      let c = spyEls[0];
      for (const el of spyEls) { if (el.getBoundingClientRect().top <= lim) c = el; else break; }
      const y = c.dataset.year!, r = c.dataset.reign!;
      setCur((p) => (p.year === y && p.reign === r ? p : { year: y, reign: r }));
    };
    const onScroll = () => {
      clear('eto');
      const st = cardS.current; if (st && !st.pinned && !(isTouch() || innerWidth < 900)) closeEnt();
      if (tick) return; tick = true;
      requestAnimationFrame(() => {
        tick = false; const y = scrollY;
        if (innerWidth < 900 && !root.classList.contains('is-focus')) {
          const hide = y > lastY + 6 && y > 160 ? true : y < lastY - 6 || y < 90 ? false : root.classList.contains('hdr-hidden');
          if (hide !== root.classList.contains('hdr-hidden')) { root.classList.toggle('hdr-hidden', hide); root.style.setProperty('--hs', hide ? '0px' : ''); }
        }
        lastY = y; spy();
      });
    };
    const onResize = () => {
      if (innerWidth >= 900 && root.classList.contains('hdr-hidden')) { root.classList.remove('hdr-hidden'); root.style.setProperty('--hs', ''); }
      root.classList.toggle('touch', isTouch());
      if (cardS.current) placeCard();
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onResize);
    spy();
    if (location.hash) { const id = location.hash.slice(1); if (EM[id]) setTimeout(() => scrollToId(id), 300); }
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ delegated events on the sheet
  const live = useRef({ P, card, pop, fpop, dd, saved, threads, focus, dlg, settingsOpen, forum, tocOpen, showResults, bundle });
  useLayoutEffect(() => { live.current = { P, card, pop, fpop, dd, saved, threads, focus, dlg, settingsOpen, forum, tocOpen, showResults, bundle }; });
  const act = useRef({ openEnt, closeEnt, lightGroup, clearAl, showChar, closeAll, doFocus, toast, scrollToId, openForum, citation, entryUrl, setSaved, setDlg, setPop, setFpop, setDd, setShowResults });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshes the handler table after every render on purpose
  useLayoutEffect(() => { act.current = { openEnt, closeEnt, lightGroup, clearAl, showChar, closeAll, doFocus, toast, scrollToId, openForum, citation, entryUrl, setSaved, setDlg, setPop, setFpop, setDd, setShowResults }; });

  useEffect(() => {
    const A = () => act.current, L = () => live.current;
    let hoverM: string | null = null, downHz: HTMLElement | null = null;
    const markHover = (mi: string, on: boolean) => $$(`.ent[data-m="${mi}"]`).forEach((x) => x.classList.toggle('eh', on));

    const onClick = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement; if (!t.closest) return;
      if (!t.isConnected) return;   // React already re-rendered the clicked control away (e.g. the card's back button)
      // entity first (also closes a pinned card on an outside click)
      const en = t.closest<HTMLElement>('.ent');
      if (en && t.closest('#sheet')) {
        if (isTouch() && L().P.al) { const cl = en.classList.contains('cl') ? en : en.closest<HTMLElement>('.cl'); if (cl) A().lightGroup(cl.closest('.entry') as HTMLElement, cl.dataset.g!, cl.dataset.s!); }
        A().openEnt(en.dataset.ent!, en, { pin: true });
        return;
      }
      if (L().card && !t.closest('#ecard,#pop,#dlg')) A().closeEnt();
      if (!t.closest('#dd') && !t.closest('.mb')) A().setDd(null);
      if (!t.closest('.search')) A().setShowResults(false);
      if (!t.closest('#sheet')) return;

      const ab = t.closest<HTMLElement>('.etools .b');
      if (ab) {
        const bar = ab.closest<HTMLElement>('.etools')!, eid = bar.dataset.eid!, a = ab.dataset.act;
        if (a === 'save') {
          A().setSaved((s) => { const n = new Set(s); if (n.has(eid)) n.delete(eid); else n.add(eid); LS.set('dvsktt.saved.v1', [...n]); A().toast(n.has(eid) ? 'Đã lưu đoạn này' : 'Đã bỏ lưu'); return n; });
        } else if (a === 'cite') {
          const c = A().citation(eid);
          A().setDlg({ title: 'Trích dẫn', body: <pre>{c}</pre>, actions: [{ t: 'Sao chép', pri: true, fn: async () => A().toast((await copyText(c)) ? 'Đã sao chép trích dẫn' : 'Không sao chép được') }] });
        } else if (a === 'link') {
          void copyText(A().entryUrl(eid)).then((ok) => A().toast(ok ? 'Đã sao chép liên kết' : 'Không sao chép được'));
        } else if (a === 'src') {
          A().setDlg({ title: 'Nguồn song song (minh họa)', body: (boot.parallel[eid] || []).map((s, i) => <p key={i}><b>{s.t}</b><br /><span style={{ color: 'var(--ink2)' }}>{s.d}</span></p>) });
        } else if (a === 'forum') A().openForum(eid, 'list');
        else if (a === 'more') ab.closest('.entry')!.classList.toggle('acts-open');
        return;
      }
      const fr = t.closest<HTMLElement>('.fr');
      if (fr) {
        const li = document.getElementById(fr.closest('.entry')!.id + '-fn' + fr.dataset.n);
        if (li) { li.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1700); }
        return;
      }
      const hz = t.closest<HTMLElement>('.hz'), cl = t.closest<HTMLElement>('.cl');
      if (isTouch() && L().P.al && cl) {
        const entry = cl.closest<HTMLElement>('.entry')!;
        if (hz && alCurKey() === entry.id + ':' + cl.dataset.g) { A().showChar(hz.dataset.c!, hz); return; }
        A().setPop(null); A().lightGroup(entry, cl.dataset.g!, cl.dataset.s!); return;
      }
      if (hz) { A().showChar(hz.dataset.c!, hz); return; }
      A().setPop(null);
      if (isTouch() && L().P.al) A().clearAl();
    };
    const alCurKey = () => alCur.current;

    const onOver = (ev: MouseEvent) => {
      if (isTouch()) return;
      const t = ev.target as HTMLElement; if (!t.closest) return;
      const hzt = t.closest<HTMLElement>('#sheet .hz');
      if (hzt && !hzt.title && !hzt.classList.contains('e1')) hzt.title = `Tra từ điển từ ${hzt.dataset.c}${hzt.classList.contains('flg') ? ' · ⚑ nghi vấn, xem Góp ý sửa' : ''}`;
      // char popover: close shortly after the pointer leaves it and its character
      if (L().pop) {
        clear('pop');
        const near = t.closest('#pop') || (popSrc.current && (t === popSrc.current || popSrc.current.contains(t)));
        if (!near) later('pop', () => A().setPop(null), 260);
      }
      // entity card hover
      if (t.closest('#ecard')) { clear('etc'); clear('eto'); }
      else {
        const en = t.closest<HTMLElement>('.ent');
        if (en) {
          const mi = en.dataset.m!;
          if (hoverM !== mi) { if (hoverM != null) markHover(hoverM, false); hoverM = mi; markHover(mi, true); }
          clear('etc');
          const st = L().card;
          if (!st?.pinned && !(st && st.id === en.dataset.ent && String(st.anchor) === mi)) later('eto', () => A().openEnt(en.dataset.ent!, en, {}), 340);
        } else {
          if (hoverM != null) { markHover(hoverM, false); hoverM = null; }
          clear('eto');
          const st = L().card;
          if (st && !st.pinned) later('etc', () => A().closeEnt(), 300);
        }
      }
      // forum hover list on the toolbar button
      const fb = t.closest<HTMLElement>('.fbtn');
      if (fb) { clear('fpop'); A().setFpop({ eid: fb.closest<HTMLElement>('.etools')!.dataset.eid!, r: rectOf(fb) }); return; }
      if (t.closest('#fpop')) { clear('fpop'); return; }
      if (L().fpop) later('fpop', () => A().setFpop(null), 240);
      // menubar: moving across buttons while a menu is open switches menus
      const mb = t.closest<HTMLElement>('.mb');
      if (mb && L().dd && L().dd!.i !== Number(mb.dataset.mb)) A().setDd({ i: Number(mb.dataset.mb), r: rectOf(mb) });
      // clause pair
      if (L().P.al) {
        const cl = t.closest<HTMLElement>('#sheet .cl');
        if (cl) A().lightGroup(cl.closest<HTMLElement>('.entry')!, cl.dataset.g!, cl.dataset.s!);
        else if (alCur.current && !t.closest('#pop')) A().clearAl();
      }
    };

    const onKeyCapture = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      const st = L().card;
      if (ev.key === 'Escape' && st && !L().pop && !L().dlg) {
        ev.stopImmediatePropagation(); ev.preventDefault();
        const back = st.anchor; A().closeEnt();
        const f = back != null && $<HTMLElement>(`.ent.e1[data-m="${back}"]`);
        if (f && !isTouch()) f.focus({ preventScroll: true });
        return;
      }
      if ((ev.key === 'Enter' || ev.key === ' ') && t.classList?.contains('ent')) {
        ev.preventDefault(); ev.stopImmediatePropagation(); A().openEnt(t.dataset.ent!, t, { pin: true });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable;
      if (e.key === 'Escape') {
        const s = L();
        if (s.dlg) { A().setDlg(null); return; }
        if (s.pop || s.dd || s.fpop || s.showResults || s.tocOpen || s.settingsOpen || s.forum) { A().closeAll(); return; }
        if (s.focus) { A().doFocus(false); return; }
        A().clearAl(); return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') A().doFocus(!L().focus);
      else if (e.key === '/') { e.preventDefault(); $<HTMLInputElement>('#q')?.focus(); }
      else if ((e.key === 'Enter' || e.key === ' ') && t.classList?.contains('fr')) { e.preventDefault(); t.click(); }
    };
    // desktop: the dictionary box also opens on mouse up (works if an extension swallows clicks)
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement; if (!t.closest) return;
      downHz = e.button === 0 ? t.closest<HTMLElement>('#sheet .hz') : null;
      if (!t.closest('#pop') && !t.closest('.hz') && !t.closest('#ecard')) A().setPop(null);
    };
    const onUp = (e: MouseEvent) => {
      if (isTouch() || e.button !== 0) return;
      const t = e.target as HTMLElement; if (!t.closest) return;
      const up = t.closest<HTMLElement>('#sheet .hz'); const d = downHz; downHz = null;
      if (up && up.classList.contains('ent')) return;
      if (up && up === d && L().pop?.c !== d.dataset.c) setTimeout(() => A().showChar(d.dataset.c!, d), 20);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onOver);
    addEventListener('keydown', onKeyCapture, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('mouseover', onOver);
      removeEventListener('keydown', onKeyCapture, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // expose state for browser tests (same idea as the prototype's window.__dvsktt)
  useEffect(() => {
    (window as unknown as { __dvsktt: unknown }).__dvsktt = {
      prefs: P, card, setLang, setMode, openEnt: (id: string) => openEnt(id, null, { pin: true }), closeEnt,
      mentions: bundle?.mentions.length ?? null, entities: bundle ? Object.keys(bundle.entities).length : null,
    };
  });

  useEffect(() => { document.documentElement.classList.toggle('toc-open', tocOpen); }, [tocOpen]);

  // ------------------------------------------------------------ render helpers
  const scrim = tocOpen || settingsOpen || !!forum;
  const N = 6, ys = boot.years;
  const yIdx = ys.findIndex((y) => y.id === cur.year);
  let strip = stripOpen ? ys : ys.slice(0, N);
  if (!stripOpen && yIdx >= N) strip = strip.concat([ys[yIdx]]);
  const r0 = RM[cur.reign] || boot.reigns[0];

  const ddItems = (items: NavNode[], path: string): ReactNode => (
    <ul>
      {items.map((it, k) => {
        const kids = !!it.kids?.length, key = path + '/' + k, isCur = it.chapter === boot.slug && !it.anchor, off = !it.chapter;
        return (
          <li key={k} className={`${kids ? 'has-sub' : ''}${ddOpenSub.has(key) ? ' open' : ''}`}>
            <button className={`it${isCur ? ' cur' : ''}${off ? ' dim' : ''}`} disabled={off && !kids}
              onClick={() => {
                if (it.anchor) { setDd(null); scrollToId(it.anchor); }
                else if (kids) setDdOpenSub((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
              }}>
              <span className="dot" /><span>{mt(it.t)}</span>{kids ? <span className="sp">▸</span> : null}
            </button>
            {kids ? ddItems(it.kids!, key) : null}
          </li>
        );
      })}
      {!items.length ? <li><button className="it dim" disabled><span className="dot" /><span>{t('Chưa có dữ liệu', 'No data yet')}</span></button></li> : null}
    </ul>
  );
  useLayoutEffect(() => {
    const d = ddRef.current; if (!dd || !d) return;
    d.classList.remove('flip');
    const w = d.offsetWidth;
    d.style.left = Math.max(8, Math.min(dd.r.left, innerWidth - w - 8)) + 'px'; d.style.top = dd.r.bottom + 6 + 'px';
    if (d.getBoundingClientRect().right + 240 > innerWidth) d.classList.add('flip');
  }, [dd]);

  const searchOut = (() => {
    if (!results || !q.trim()) return null;
    const qq = q.trim(), zh = HAN.test(qq), nq = zh ? normZh(qq) : norm(qq);
    const out: ReactNode[] = [];
    for (const e of results) {
      const text = zh ? e.zh : P.lang === 'en' ? e.en : e.vi;
      const hay = zh ? normZh(text) : norm(text); const i = hay.indexOf(nq); if (i < 0) continue;
      const a = Math.max(0, i - 26), b = Math.min(text.length, i + qq.length + 46);
      const y = YM[e.year];
      out.push(
        <button key={e.id} className="res" onClick={() => { closeAll(); scrollToId(e.id); }}>
          <div className="rd">{rname(RM[e.reign])} · {y.title}{y.jul ? ' [' + y.jul + ']' : ''}</div>
          <div className={zh ? 'rz' : 'rv'}>{a > 0 ? '…' : ''}{text.slice(a, i)}<mark>{text.slice(i, i + qq.length)}</mark>{text.slice(i + qq.length, b)}{b < text.length ? '…' : ''}</div>
        </button>,
      );
      if (out.length >= 30) break;
    }
    return out.length ? out : <div className="empty">{t('Không có kết quả.', 'No results.')}</div>;
  })();

  const charPop = pop ? (() => {
    const c = pop.c, enc = encodeURIComponent(c), hv = boot.lexicon.hanviet[c], gl = boot.lexicon.glossary[c], v = VAR[c];
    const A = ({ href, children: ch }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{ch}</a>;
    return (
      <>
        <button className="pclose" onClick={() => setPop(null)} aria-label={t('Đóng', 'Close')} title={t('Đóng (Esc)', 'Close (Esc)')}>×</button>
        <div className="prow"><div className="bigc" lang="zh-Hant">{c}</div>
          <div className="pinfo">
            {hv ? <div className="hv">{hv}</div> : <div className="gl">{t('Chưa có âm Hán-Việt trong từ điển mini', 'No Sino-Vietnamese reading in the mini dictionary')}</div>}
            {gl ? <div className="gl">{gl}</div> : null}
            {v ? <div className="gl">{t('Dị thể của', 'Variant of')} {v}</div> : null}
          </div></div>
        <div className="lk">
          <A href={'https://hvdic.thivien.net/whv/' + enc}>thivien</A><A href={'https://zdic.net/hant/' + enc}>zdic</A>
          <A href={`https://www.nomfoundation.org/nom-tools/Nom-Lookup-Tool/Nom-Lookup-Tool?input_type=rqn_or_hn&inputText=${enc}&uiLang=en&GO=GO`}>nomfoundation</A>
        </div>
      </>
    );
  })() : null;

  const threadRow = (x: Thread) => (
    <button key={x.id} className="trow" role="menuitem" onClick={() => openForum(x.entry, 'thread', x.id)}>
      <b>{x.title}</b><span>{x.author} · {rel(lastAct(x))} · {x.replies.length} phản hồi · <i className={`st ${stCls(x.status)}`}>{x.status}</i></span>
    </button>
  );

  const S = boot.stats;
  const modeLabel = (m: Prefs['mode'], short = false) => (m === 'both' ? t('Cả hai', 'Both') : m === 'zh' ? '中文' : short ? t('Việt', 'EN') : t('Tiếng Việt', 'English'));
  const seg = (short?: boolean) => (
    <>{(['both', 'zh', 'vi'] as const).map((m) => <button key={m} data-mode={m} aria-pressed={P.mode === m} onClick={() => setMode(m)}>{modeLabel(m, short)}</button>)}</>
  );

  // ------------------------------------------------------------ markup (ids and classes from the prototype)
  return (
    <>
      <a className="skip" href="#sheet">{t('Bỏ qua, tới nội dung', 'Skip to content')}</a>
      <header className="top" id="top">
        <button className="icon" id="bMenu" aria-label={t('Mục lục', 'Contents')} aria-expanded={tocOpen} title={t('Mục lục', 'Contents')} onClick={() => { const o = !tocOpen; closeAll(); setTocOpen(o); }}><I.Menu /></button>
        <div className="brand"><span className="chop">史</span><span className="brand-t">Đại Việt Sử Ký Toàn Thư</span></div>
        <div className="hdr-modes">
          <div className="seg mode-seg" role="group" aria-label={t('Chế độ hiển thị', 'Layout')}>{seg()}</div>
          <div className="seg lang-seg" role="group" aria-label="Ngôn ngữ bản dịch / Translation language">
            <button data-lang="vi" aria-pressed={P.lang === 'vi'} title="Tiếng Việt" onClick={() => setLang('vi')}>VI</button>
            <button data-lang="en" aria-pressed={P.lang === 'en'} title="English" onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
        <div className="search">
          <I.Search />
          <input id="q" type="search" placeholder={t('Tìm: Bộ Lĩnh, 部領, sứ quân…', 'Search: Bộ Lĩnh, 部領, warlords…')} autoComplete="off" aria-label={t('Tìm trong văn bản', 'Search the text')}
            value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { if (q.trim()) void runSearch(q); }} />
          <div id="results" hidden={!showResults}>{searchOut}</div>
        </div>
        <button className="icon" id="bGear2" aria-label={t('Tùy chọn', 'Settings')} title={t('Tùy chọn', 'Settings')} onClick={() => { closeAll(); setSettingsOpen(true); }}><I.Gear /></button>
      </header>

      <aside className="toc" id="toc" aria-label={t('Mục lục', 'Contents')} aria-hidden={!tocOpen}>
        <div className="th"><b>{t('Mục lục', 'Contents')}</b><button className="icon" onClick={closeAll} aria-label={t('Đóng', 'Close')}><I.Close /></button></div>
        {(() => {
          const out: ReactNode[] = []; let ly: string | null = null; let items: ReactNode[] = [];
          const flush = (k: string) => { if (items.length) out.push(<ul key={'u' + k}>{items}</ul>); items = []; };
          boot.entries.forEach((e) => {
            if (e.year !== ly) { flush(e.id); const y = YM[e.year]; out.push(<h2 key={'h' + e.id}>{rname(RM[e.reign])} · {y.title}{y.jul ? ` [${y.jul}]` : ''}</h2>); ly = e.year; }
            const tx = P.lang === 'en' ? e.en : e.vi;
            items.push(<li key={e.id}><button onClick={() => { closeAll(); scrollToId(e.id); }}>{tx.length > 62 ? tx.slice(0, 60) + '…' : tx}{e.type === 'comment' ? <small>{t('Nhận xét', 'Commentary')}</small> : null}</button></li>);
          });
          flush('end');
          return out;
        })()}
      </aside>

      <main id="main">
        <nav className="menubar" id="menubar" aria-label={t('Chọn phần văn bản', 'Sections')}>
          {boot.work.sections.map((m, i) => {
            const curSec = m.items.some((x) => x.chapter === boot.slug);
            return (
              <button key={i} className={`mb${curSec ? ' cur' : ''}`} data-mb={i} aria-haspopup="true" aria-expanded={dd?.i === i}
                onClick={(e) => { if (dd?.i === i) setDd(null); else setDd({ i, r: rectOf(e.currentTarget) }); }}>
                <I.Folder /><span>{mt(m.t)}</span><I.Caret />
              </button>
            );
          })}
        </nav>
        <div className="titleline" id="titleline">
          <h1 className="tz" lang="zh-Hant" style={{ margin: 0 }}>{boot.title.zh} · {r0.zh}</h1>
          <span className="tv">({t(boot.title.vi, boot.title.en)} · {rname(r0)})</span>
        </div>
        <section className="datebar" id="datebar" aria-label={t('Chọn năm', 'Choose a year')}>
          <span className="db-lab">{t('Năm tháng', 'Years')}</span>
          <div className="strip" id="strip">
            {strip.map((y) => (
              <button key={y.id} className="chip" aria-pressed={y.id === cur.year} onClick={() => scrollToId(y.gz ? 'Y-' + y.id : 'R-' + y.reign)}>
                {ylab(y)}{y.jul ? <> <small>[{y.jul}]</small></> : null}
              </button>
            ))}
            {ys.length > N ? (
              <button className="chip more" aria-expanded={stripOpen} onClick={() => setStripOpen(!stripOpen)}>
                {stripOpen ? t('Thu gọn ▴', 'Less ▴') : t(`+${ys.length - N} năm ▾`, `+${ys.length - N} more ▾`)}
              </button>
            ) : null}
          </div>
        </section>
        <div id="sheet" className="sheet">{children}</div>
        <footer className="endnote" id="endnote">
          {t(`Hết ${boot.title.vi} (${boot.span.years} năm, ${boot.span.from}–${boot.span.to}). Bản Hán: ${S.zh}/${S.passages} đoạn · ${S.groups} nhóm câu tương ứng.`,
            `End of the ${boot.title.en} (${boot.span.years} years, ${boot.span.from}–${boot.span.to}). Chinese text: ${S.zh}/${S.passages} passages. English is an AI-assisted draft.`)}
        </footer>
      </main>

      <nav className="rail" id="rail" aria-label={t('Công cụ', 'Tools')}>
        <button id="bGear" title={t('Tùy chọn', 'Settings')} aria-label={t('Tùy chọn', 'Settings')} onClick={() => { closeAll(); setSettingsOpen(true); }}><I.Gear /></button>
        <button id="bTheme" title={t('Sáng / tối', 'Light / dark')} aria-label={t('Đổi sáng tối', 'Toggle theme')} onClick={toggleTheme}><I.Theme /></button>
        <button id="bFocus" title={t('Đọc tập trung (phím F)', 'Focus mode (F)')} aria-label={t('Đọc tập trung', 'Focus mode')} aria-pressed={focus} onClick={() => doFocus(true)}><I.Focus /></button>
        <button id="bTop" title={t('Lên đầu trang', 'Back to top')} aria-label={t('Lên đầu trang', 'Back to top')} onClick={() => scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' })}><I.Top /></button>
      </nav>

      <div id="scrim" hidden={!scrim} onClick={closeAll} />
      <div id="dd" ref={ddRef} hidden={!dd}>{dd ? ddItems(boot.work.sections[dd.i].items, String(dd.i)) : null}</div>

      <aside className={`panel${settingsOpen ? ' open' : ''}`} id="settings" aria-label={t('Tùy chọn', 'Settings')} aria-hidden={!settingsOpen}>
        <div className="ph"><h3>{t('Tùy chọn', 'Settings')}</h3><button className="icon" onClick={closeAll} aria-label={t('Đóng', 'Close')}><I.Close /></button></div>
        <div className="pb" id="settingsBody">
          <h4>{t('Ngôn ngữ bản dịch', 'Translation language')}</h4>
          <div className="seg" role="group" style={{ display: 'flex' }}>
            <button data-lang="vi" aria-pressed={P.lang === 'vi'} style={{ flex: 1 }} onClick={() => setLang('vi')}>Tiếng Việt</button>
            <button data-lang="en" aria-pressed={P.lang === 'en'} style={{ flex: 1 }} onClick={() => setLang('en')}>English</button>
          </div>
          <p className="legend" style={{ margin: '8px 0 0' }}>{t('Bản tiếng Anh là bản dịch thử do AI làm từ nguyên văn Hán, chưa biên tập. Sáng câu tương ứng và chú thích chỉ có ở bản tiếng Việt.', 'The English is an AI-assisted draft translated from the Chinese original and not yet edited. Footnotes exist only in the Vietnamese version, and English highlighting is approximate (phrase by phrase).')}</p>
          <h4>{t('Bố cục', 'Layout')}</h4>
          <div className="seg" role="group" style={{ display: 'flex' }}>{(['both', 'zh', 'vi'] as const).map((m) => <button key={m} data-mode={m} aria-pressed={P.mode === m} style={{ flex: 1 }} onClick={() => setMode(m)}>{modeLabel(m)}</button>)}</div>
          <h4>{t('Cỡ chữ', 'Text size')}</h4>
          <div className="sizebox"><button className="btn" onClick={() => setSize(-1)} aria-label="A−">A−</button><b id="szv">{Math.round(P.rs * 100)}%</b><button className="btn" onClick={() => setSize(1)} aria-label="A+">A+</button></div>
          <h4>{t('Giao diện', 'Theme')}</h4>
          <div className="seg" role="group" style={{ display: 'flex' }}>
            {([['auto', 'Theo máy', 'Auto'], ['light', 'Sáng', 'Light'], ['dark', 'Tối', 'Dark']] as const).map(([k, v, e]) => <button key={k} data-theme={k} aria-pressed={P.theme === k} style={{ flex: 1 }} onClick={() => setPref({ theme: k })}>{t(v, e)}</button>)}
          </div>
          <h4>{t('Hiển thị', 'Display')}</h4>
          {SWITCHES.map(([k, vt, vd, et, ed]) => (
            <div className="row" key={k}><div>{t(vt, et)}<small>{t(vd, ed)}</small></div>
              <button className="sw" role="switch" data-sw={k} aria-checked={!!P[k]} aria-label={t(vt, et)} onClick={() => { if (k === 'al') clearAl(); setPref({ [k]: !P[k] } as Partial<Prefs>); }} /></div>
          ))}
          <h4>{t('Chú giải ký hiệu', 'Symbols')}</h4>
          {P.lang === 'en' ? (
            <div className="legend"><span className="fo">fol. 1b</span> page break of the woodblock edition<br /><b>[ ]</b> translator insertion &nbsp; <b>( )</b> small note in the original<br /><b style={{ textDecoration: 'underline wavy var(--seal)' }}>char</b> doubtful Chinese character<br /><span className="ent-sample">light underline</span> person, place, office…: hover for the card, click to pin<br />Click a Chinese character to look it up.</div>
          ) : (
            <div className="legend"><span className="fo">tờ 1b</span> chỗ sang tờ mới của bản khắc<br /><b>[ ]</b> chữ do dịch giả thêm &nbsp; <b>( )</b> chú nhỏ của nguyên văn<br /><span className="fr">1</span> chú thích, nằm dưới đoạn văn<br /><b style={{ textDecoration: 'underline wavy var(--seal)' }}>chữ</b> chữ Hán nghi vấn, xem Góp ý sửa<br /><span className="ent-sample">gạch chân nhạt</span> tên người, địa danh, chức tước…: rê chuột để xem thẻ, bấm để ghim<br />Bấm vào một chữ Hán để tra từ điển.</div>
          )}
          <h4>{t('Dữ liệu', 'Data')}</h4>
          <div className="legend">{t(
            `Bản dịch tiếng Việt: ${S.passages} đoạn từ file PDF. Bản Hán: ${S.zh}/${S.passages} đoạn (Wikisource). Nhóm câu tương ứng: ${S.groups}. Thực thể: ${S.entities} thực thể chuẩn, ${S.mentions} chỗ xuất hiện có liên kết (cơ sở dữ liệu thực thể V4). Bản thử riêng tư, chưa xin phép bản quyền bản dịch. Đừng chia sẻ công khai.`,
            `Vietnamese translation: ${S.passages} passages from the PDF. Chinese: ${S.zh}/${S.passages} passages (Wikisource). Matched clause groups: ${S.groups}. Entities: ${S.entities} canonical, ${S.mentions} linked occurrences (V4 entity database). Private prototype; copyright permission for the translations has not been obtained. Please do not share publicly.`)}</div>
        </div>
      </aside>

      <aside className={`panel wide${forum ? ' open' : ''}`} id="forum" aria-label="Góp ý sửa" aria-hidden={!forum}>
        <div className="ph">
          <button className="icon" id="fBack" aria-label="Quay lại" hidden={!forum || forum.view === 'list'} onClick={() => forum && setForum({ eid: forum.eid, view: 'list' })}><I.Back /></button>
          <h3 id="forumTitle">{forum?.view === 'new' ? 'Góp ý cho đoạn này' : 'Góp ý sửa'}</h3><button className="icon" onClick={closeAll} aria-label={t('Đóng', 'Close')}><I.Close /></button>
        </div>
        <div className="pb" id="forumBody">{forum ? <ForumBody key={forum.eid + forum.view + (forum.tid || '')} forum={forum} setForum={setForum} threads={threads} setThreads={setThreads} threadsFor={threadsFor} entryLabel={entryLabel} EM={EM} toast={toast} threadRow={threadRow} /> : null}</div>
      </aside>

      <div className="pop char" id="pop" ref={popRef} hidden={!pop} role="dialog" aria-label={t('Tra từ điển', 'Dictionary')} data-c={pop?.c || ''}>{charPop}</div>
      <div className="pop" id="fpop" ref={fpopRef} hidden={!fpop} role="menu" aria-label="Các góp ý sửa">
        {fpop ? <>
          {threadsFor(fpop.eid).length ? threadsFor(fpop.eid).sort((a, b) => lastAct(b) - lastAct(a)).slice(0, 6).map(threadRow) : <div className="empty">Chưa có góp ý nào cho đoạn này.</div>}
          <div className="fpf"><button className="trow" onClick={() => openForum(fpop.eid, 'new')}><b>＋ Báo lỗi / góp ý cho đoạn này</b></button></div>
        </> : null}
      </div>
      <div id="pairbar" hidden={!pair}>
        {pair ? <><small>Câu đang chọn và câu tương ứng</small>{pair.zhFirst ? <><div className="zhp">{pair.b}</div><div className="vip">{pair.a}</div></> : <><div className="vip">{pair.a}</div><div className="zhp">{pair.b}</div></>}</> : null}
      </div>
      <div id="fbar" hidden={!focus} role="toolbar" aria-label={t('Điều khiển khi đọc tập trung', 'Focus mode controls')}>
        <div className="seg">{seg(true)}</div>
        <button className="fb" onClick={() => setSize(-1)} aria-label={t('Giảm cỡ chữ', 'Smaller text')}>A−</button>
        <button className="fb" onClick={() => setSize(1)} aria-label={t('Tăng cỡ chữ', 'Larger text')}>A+</button>
        <button className="fb" id="fTheme" onClick={toggleTheme} aria-label={t('Đổi sáng tối', 'Toggle theme')}>◐</button>
        <button className="fb exit" id="fExit" onClick={() => doFocus(false)}>{t('✕ Thoát', '✕ Exit')}</button>
      </div>
      <div className="modal" id="dlg" hidden={!dlg} onClick={(e) => { if ((e.target as HTMLElement).id === 'dlg') setDlg(null); }}>
        {dlg ? <div className="mbox" role="dialog" aria-modal="true"><h3 id="dlgT">{dlg.title}</h3><div id="dlgB">{dlg.body}</div>
          <div className="macts" id="dlgA">{[...(dlg.actions || []), { t: t('Đóng', 'Close') }].map((x, i) => (
            <button key={i} className={`btn${'pri' in x && x.pri ? ' pri' : ''}`} onClick={() => { if ('fn' in x && x.fn) x.fn(); setDlg(null); }}>{x.t}</button>
          ))}</div></div> : null}
      </div>
      <div id="toast" hidden={!toastMsg} role="status">{toastMsg}</div>
      <div id="escrim" hidden={!(card && sheetMode)} onClick={closeEnt} />
      <aside id="ecard" ref={cardRef} hidden={!card} className={sheetMode ? 'sheet' : ''} role="dialog" aria-label="Thực thể / Entity" aria-labelledby={card ? 'ecT' : undefined}
        onClick={(e) => { e.stopPropagation(); if (!(e.target as HTMLElement).closest('a')) setCard((c) => (c ? { ...c, pinned: true } : c)); }}>
        {card && bundle && ix ? (
          <CardBody b={bundle} ix={ix} st={card}
            onTab={(tab) => { setCard({ ...card, pinned: true, tab }); requestAnimationFrame(() => { const b = $('#ecard .ec-b'); if (b) b.scrollTop = 0; }); }}
            onGo={(id) => openEnt(id, null, { pin: true, push: true })}
            onBack={() => { const h = [...card.hist]; const id = h.pop()!; setCard({ ...card, id, hist: h, tab: 'ov', pinned: true }); }}
            onClose={closeEnt} onOcc={goOcc} onChar={(c, el) => showChar(c, el)} />
        ) : card ? <div className="ec-b"><p className="ec-sum">…</p></div> : null}
      </aside>
    </>
  );
}

// entity names for aria labels and tests
export { entName };
