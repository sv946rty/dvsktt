// Small browser helpers shared by the reader client components.
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
export const HAN = /[㐀-鿿豈-﫿\u{20000}-\u{2FFFF}]/u;
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
export const isTouch = () => matchMedia('(hover:none)').matches;
export const reduceMotion = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
export const LS = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try {
      const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0';
      document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok;
    } catch { return false; }
  }
}
export function rel(ts: number) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'vừa xong';
  if (d < 3600) return Math.floor(d / 60) + ' phút trước';
  if (d < 86400) return Math.floor(d / 3600) + ' giờ trước';
  if (d < 86400 * 30) return Math.floor(d / 86400) + ' ngày trước';
  return new Date(ts).toLocaleDateString('vi-VN');
}
export type Rect = { left: number; right: number; top: number; bottom: number };
export const rectOf = (el: Element): Rect => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
export function unionRect(els: Element[]): Rect | null {
  if (!els.length) return null;
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
  els.forEach((x) => { const q = x.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
  return { left: l, top: t, right: r, bottom: b };
}
/** Prototype placePop(): below the target, flipped above when there is no room. */
export function placeBelow(pop: HTMLElement, r: Rect) {
  pop.style.left = '0px'; pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const left = Math.max(10, Math.min(r.left, innerWidth - pw - 10));
  let top = r.bottom + 8;
  if (top + ph > innerHeight - 10) top = r.top - ph - 8;
  if (top < 10) top = 10;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
}
