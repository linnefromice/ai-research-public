import type { APIRoute } from 'astro';
import { features } from '../../features';
import { getCfEnv } from '../../lib/api-helpers';
import { getUnpublishedIds, toD1Id } from '../../lib/d1-client';
import { fetchReportContentById } from '../../lib/runtime-reports';

// Why SSR (not prerender):
//   Cloudflare Workers static asset delivery sets Content-Type from the file
//   extension as `text/markdown` with no charset, which mojibakes Japanese in
//   browsers. SSR keeps full control over the response headers.
//
// Why D1 (not getCollection):
//   Calling getCollection() from any SSR route forces Astro to bundle the
//   full Content Collections data into the Worker script — pushing the
//   bundle past the 3 MiB free / 10 MiB paid limit (PR #437 background).
//   Reading the markdown body from D1 keeps the live + archive Content
//   Collections out of the Worker entirely.
//
// Trade-off: D1 must hold the markdown content. That's automatic for fresh
// reports (pipeline registers `content`); for older archived reports we
// run a one-time backfill from `features/<f>/archive/*.md`. See pipeline-
// side `shared/scripts/backfill-d1-archive-content.sh`.
export const prerender = false;

const NOT_FOUND_MESSAGE = 'Not Found';

function notFound(): Response {
  return new Response(NOT_FOUND_MESSAGE, {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const feature = params.feature;
  const slug = params.slug;
  if (!feature || !slug) return notFound();

  // feature 一覧にない slug はエラー
  if (!features.find((f) => f.slug === feature)) return notFound();

  const cfEnv = getCfEnv();
  if (!cfEnv?.DB) {
    return new Response('Service unavailable', { status: 503 });
  }

  const d1Id = toD1Id(feature, slug);

  // Unpublished は HTML と同様に公開しない
  const unpublished = await getUnpublishedIds();
  if (unpublished.has(d1Id)) return notFound();

  const row = await fetchReportContentById(cfEnv.DB, d1Id);
  if (!row?.content) return notFound();

  return new Response(row.content, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${slug}.md"`,
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};
