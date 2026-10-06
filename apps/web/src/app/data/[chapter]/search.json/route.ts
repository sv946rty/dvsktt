import { CHAPTERS, loadChapter } from '@/lib/content/load';
import { searchDocs } from '@/lib/reader/boot';

export const dynamic = 'force-static';
export const generateStaticParams = () => Object.keys(CHAPTERS).map((chapter) => ({ chapter }));

export async function GET(_req: Request, ctx: RouteContext<'/data/[chapter]/search.json'>) {
  const d = loadChapter((await ctx.params).chapter);
  if (!d) return new Response('not found', { status: 404 });
  return Response.json(searchDocs(d));
}
