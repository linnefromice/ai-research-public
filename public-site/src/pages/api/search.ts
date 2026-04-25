/**
 * Full-text search over reports.
 * Replaces the SSR rendering in pages/search.astro that returned
 * "[object Object]" on Cloudflare Workers (cf-astro-patterns §16).
 */
import type { APIRoute } from 'astro';
import { jsonError, jsonResponse, requireDB } from '../../lib/api-helpers';

export const prerender = false;

interface SearchHit {
  id: string;
  feature: string;
  date: string;
  title: string | null;
  summary: string | null;
  tldr: string | null;
}

export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;

  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return jsonResponse({ results: [], q });
  }

  try {
    const ftsQuery = q.replace(/"/g, ' ');
    const r = await guard.db
      .prepare(
        `SELECT r.id, r.feature, r.date, r.title, r.summary, r.tldr
         FROM reports_fts
         JOIN reports r ON r.rowid = reports_fts.rowid
         WHERE reports_fts MATCH ? AND r.published = 1
         ORDER BY bm25(reports_fts)
         LIMIT 30`
      )
      .bind(ftsQuery)
      .all<SearchHit>();
    return jsonResponse({ results: r.results ?? [], q });
  } catch (e) {
    console.error('[search] query failed', e);
    return jsonError('Search failed', 500);
  }
};
