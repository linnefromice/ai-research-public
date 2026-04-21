import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { features } from '../../features';
import { getUnpublishedIds, toD1Id } from '../../lib/d1-client';

// SSR で返す理由:
// prerender (getStaticPaths) にすると dist/client/*.md の静的ファイルになり、
// Cloudflare Worker static 配信が Content-Type を拡張子ベースの
// `text/markdown` (charset なし) で返してしまう → Japanese ブラウザが
// 文字化け。SSR にすると handler のレスポンスヘッダがそのまま使われる。
// Content Collection はビルド時に bundle されているため SSR でも
// 追加 I/O なしで済む。Cache-Control の s-maxage で CDN キャッシュで吸収。
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const feature = params.feature;
  const slug = params.slug;
  if (!feature || !slug) return notFound();

  // feature 一覧にない slug はエラー
  const feat = features.find(f => f.slug === feature);
  if (!feat) return notFound();

  let reports: Array<{ id: string; body?: string | undefined }>;
  try {
    reports = (await getCollection(feature as any)) as any;
  } catch {
    return notFound();
  }

  const report = reports.find(r => r.id === slug);
  if (!report) return notFound();

  // Unpublished は HTML と同様に公開しない
  const unpublished = await getUnpublishedIds();
  if (unpublished.has(toD1Id(feature, report.id))) return notFound();

  return new Response(report.body ?? '', {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${report.id}.md"`,
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
