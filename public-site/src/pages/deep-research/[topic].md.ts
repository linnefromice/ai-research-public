import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/api-helpers';
import { fetchReportContentById } from '../../lib/runtime-reports';

// SSR で返す (理由は [feature]/[...slug].md.ts のコメント参照)。
// D1 から取得することで Content Collections を Worker bundle から外し、
// archive 内容も含めてサイズを小さく保つ (PR #437 / archive collection 設計)。
// Deep Research は purge 対象外なので D1 content が常に保持されている。
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const topic = params.topic;
  if (!topic) return notFound();

  const cfEnv = getCfEnv();
  if (!cfEnv?.DB) {
    return new Response('Service unavailable', { status: 503 });
  }

  // Deep Research の D1 id 形式は `deep-research/<topic>`
  const d1Id = `deep-research/${topic}`;
  const row = await fetchReportContentById(cfEnv.DB, d1Id);
  if (!row?.content) return notFound();

  const filename = `deep-research-${topic}.md`;

  return new Response(row.content, {
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
