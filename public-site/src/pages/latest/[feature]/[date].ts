import type { APIRoute } from 'astro';
import { Marked } from 'marked';
import { getCfEnv } from '../../../lib/api-helpers';
import { fetchReportByFeatureDate } from '../../../lib/runtime-reports';
import { buildReportCardTitle, getFeatureLabel } from '../../../features';

/**
 * SSR preview detail page for daily reports that are published in D1 but not
 * yet reflected in the static build. Returns a self-contained HTML response.
 *
 * URL: /latest/<feature>/<date>/
 *
 * Was originally an `.astro` page but Astro 6.1 + @astrojs/cloudflare 13 has a
 * bundling/runtime bug where any SSR `.astro` page returns the literal string
 * `[object Object]` (15 bytes) instead of the rendered HTML. SSR `.ts`
 * endpoints render correctly. See cloudflare-astro-patterns.md §16 (PR #161).
 *
 * Trade-off: this loses BaseLayout / React islands (ReactionBar / NoteEditor /
 * ReadAloudPanel). Engagement features are still available on the canonical
 * static URL `/<feature>/<date>/` after the next deploy.
 *
 * Design: docs/plans/2026-04-23-daily-preview-d1-design.md (private)
 */
export const prerender = false;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripFrontmatter(md: string): string {
  const normalized = md.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return md;
  const end = normalized.indexOf('\n---', 4);
  if (end <= 0) return md;
  return normalized.slice(end + 4).replace(/^\n+/, '');
}

function sanitizeUrls(html: string): string {
  return html
    .replace(/(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*["']\s*data:[^"']*["']/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*["']\s*vbscript:[^"']*["']/gi, '$1="#"');
}

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const { feature, date } = params as { feature: string; date: string };

  // Validate params: feature must be safe slug, date must be ISO YYYY-MM-DD.
  // Deep Research is served via its own runtime-visibility pipeline, exclude here.
  if (
    !feature ||
    !/^[a-z0-9-]{1,64}$/i.test(feature) ||
    feature === 'deep-research' ||
    !date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return notFound();
  }

  const cfEnv = getCfEnv();
  if (!cfEnv?.DB) {
    return new Response('Service unavailable', { status: 503 });
  }

  const row = await fetchReportByFeatureDate(cfEnv.DB, feature, date);
  if (!row || !row.content) {
    return notFound();
  }

  const rawMarkdown = stripFrontmatter(row.content);

  // Marked with html token suppression as XSS defense-in-depth.
  const mdRenderer = new Marked({
    gfm: true,
    breaks: false,
    renderer: {
      html: () => '',
    },
  });

  let contentHtml = '';
  try {
    const raw = await mdRenderer.parse(rawMarkdown);
    contentHtml = sanitizeUrls(raw as string);
  } catch (e) {
    console.error('[preview] marked.parse failed', e);
    return new Response('Failed to render report', { status: 500 });
  }

  const featureLabel = getFeatureLabel(feature);
  const cardTitle = row.title ?? buildReportCardTitle(feature, row.date);
  const reportLang = row.language === 'en' ? 'en' : 'ja';
  const canonicalUrl = `/${feature}/${row.date}/`;
  const readingMinutes = Math.max(1, Math.ceil(rawMarkdown.length / 600));

  const html = `<!DOCTYPE html>
<html lang="${reportLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(cardTitle)}</title>
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="robots" content="noindex">
  <link rel="stylesheet" href="/_astro/global.css">
  <style>
    body { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif; line-height: 1.7; color: #1f2937; background: #f9fafb; }
    .preview-notice { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: flex-start; }
    .preview-notice strong { color: #92400e; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; }
    .feature-label { color: #4f46e5; font-weight: 600; }
    .report-content h2 { margin-top: 2rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
    .report-content h3 { margin-top: 1.5rem; }
    .report-content a { color: #4f46e5; }
    .report-content code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.9em; }
    .report-content pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .report-content pre code { background: transparent; padding: 0; color: inherit; }
    .footer-link { display: block; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="preview-notice" role="status">
    <span aria-hidden="true">🆕</span>
    <span><strong>プレビュー表示</strong> — このレポートはまだ静的サイトに反映されていません。反映後は <a href="${escapeHtml(canonicalUrl)}">正式 URL</a> をご利用ください。</span>
  </div>

  <div class="meta">
    <span class="feature-label">${escapeHtml(featureLabel)}</span>
    <span>📅 ${escapeHtml(row.date)}</span>
    <span>📖 ${readingMinutes} min read</span>
  </div>

  <h1>${escapeHtml(cardTitle)}</h1>

  <article class="report-content">${contentHtml}</article>

  <a class="footer-link" href="/${feature}/">← ${escapeHtml(featureLabel)} 一覧に戻る</a>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
};
