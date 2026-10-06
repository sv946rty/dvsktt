import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Sheet, buildSheet } from '@/components/reader/Sheet';
import { ReaderApp } from '@/components/reader/client/ReaderApp';
import { CHAPTERS, loadChapter, loadLexicon, loadWork } from '@/lib/content/load';
import { makeBoot } from '@/lib/reader/boot';

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(CHAPTERS).map((chapter) => ({ chapter }));

export async function generateMetadata(props: PageProps<'/[chapter]'>): Promise<Metadata> {
  const d = loadChapter((await props.params).chapter);
  return d ? { title: `${d.chapter.title.vi} · ${d.chapter.title.zh}` } : {};
}

export default async function ChapterPage(props: PageProps<'/[chapter]'>) {
  const { chapter: slug } = await props.params;
  const data = loadChapter(slug);
  if (!data) notFound();
  const lex = loadLexicon();
  const { models, warnings, applied } = buildSheet(data, lex);
  if (warnings.length) console.warn(`[${slug}] ${warnings.length} render warnings:\n  ` + warnings.join('\n  '));
  const boot = makeBoot(slug, loadWork(CHAPTERS[slug].work), data, lex, applied);
  return (
    <ReaderApp boot={boot}>
      <Sheet data={data} models={models} />
    </ReaderApp>
  );
}
