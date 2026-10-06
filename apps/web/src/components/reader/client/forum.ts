// "Góp ý sửa" (correction discussions). Prototype behaviour: seeded from content, new threads and
// replies stay in this browser until accounts and the corrections database exist (phase 2).
import type { Discussion } from '@dvsktt/core';
import { LS } from './util';

export type Reply = { author: string; body: string; ts: number };
export type Thread = Omit<Discussion, 'replies' | 'ago'> & { ts: number; replies: Reply[] };
const KEY = 'dvsktt.forum.v1';

export function loadForum(seed: Discussion[]): Thread[] {
  const list = LS.get<Thread[]>(KEY, []);
  let changed = false;
  for (const t of seed) {
    if (list.some((x) => x.id === t.id)) continue;
    const { ago, replies, ...rest } = t;
    list.push({ ...rest, ts: Date.now() - ago * 864e5, replies: replies.map((r) => ({ author: r.author, body: r.body, ts: Date.now() - r.ago * 864e5 })) });
    changed = true;
  }
  if (changed) LS.set(KEY, list);
  return list;
}
export const saveForum = (l: Thread[]) => LS.set(KEY, l);
export const lastAct = (t: Thread) => Math.max(t.ts, ...t.replies.map((r) => r.ts));
export const stCls = (s: string) => (/xác nhận|đã sửa/i.test(s) ? 's-ok' : 's-open');
