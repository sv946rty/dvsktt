import Link from 'next/link';
import { CHAPTERS, loadChapter, loadWork } from '@/lib/content/load';

// Library landing page: the work, its sections, and which chapters have content.
export default function Home() {
  const work = loadWork('dvsktt');
  const available = new Set(Object.keys(CHAPTERS));
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-ui text-ink">
      <div className="flex items-center gap-3">
        <span className="chop">史</span>
        <div>
          <h1 className="m-0 font-vi text-3xl font-semibold">{work.title.vi}</h1>
          <p className="m-0 font-zh text-lg tracking-widest text-ink2" lang="zh-Hant">{work.title.zh}</p>
        </div>
      </div>
      <p className="mt-4 text-ink2">
        Đọc song song nguyên văn Hán, bản dịch tiếng Việt và bản dịch tiếng Anh. Bản thử riêng tư: đừng chia sẻ công khai.
      </p>
      <div className="mt-8 grid gap-4">
        {work.sections.map((s) => (
          <section key={s.t} className="rounded-xl border border-rule bg-leaf p-4">
            <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-ink2">{s.t}</h2>
            {s.items.length ? (
              <ul className="m-0 mt-2 grid list-none gap-1 p-0 sm:grid-cols-2">
                {s.items.map((it) => {
                  const d = it.chapter && available.has(it.chapter) ? loadChapter(it.chapter) : null;
                  return (
                    <li key={it.t}>
                      {d ? (
                        <Link href={`/${it.chapter}`} className="flex items-baseline justify-between rounded-lg px-3 py-2 font-vi text-lg text-ink no-underline hover:bg-paper2">
                          <span>{it.t} <span className="font-zh text-base text-seal" lang="zh-Hant">{d.chapter.title.zh}</span></span>
                          <span className="font-ui text-xs text-ink2">{d.passages.length} đoạn · {d.chapter.span.from}–{d.chapter.span.to}</span>
                        </Link>
                      ) : (
                        <span className="block rounded-lg px-3 py-2 font-vi text-lg text-ink2 opacity-60">{it.t}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 mt-2 px-3 py-2 text-sm text-ink2">Chưa có dữ liệu</p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
