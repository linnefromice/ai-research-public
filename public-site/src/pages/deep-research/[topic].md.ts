import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// SSR で返す (理由は [feature]/[...slug].md.ts のコメント参照)。
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const topic = params.topic;
  if (!topic) return notFound();

  let reports;
  try {
    reports = await getCollection('deep-research');
  } catch {
    return notFound();
  }

  // .astro の getStaticPaths と同じ条件: topic フィールド優先、なければ id 一致
  const report = reports.find(r => (r.data.topic || r.id) === topic);
  if (!report) return notFound();

  const filename = `deep-research-${report.data.topic || report.id}.md`;

  return new Response(report.body ?? '', {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  });
};

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
