/**
 * Top reports by reaction count over the past N days.
 * Replaces the SSR rendering in pages/rankings.astro
 * (cf-astro-patterns §16).
 */
import type { APIRoute } from 'astro';
import { jsonError, jsonResponse, requireDB } from '../../lib/api-helpers';

export const prerender = false;

interface TopReport {
  id: string;
  feature: string;
  date: string;
  title: string;
  reaction_count: number;
}

export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;

  const url = new URL(context.request.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') ?? '30', 10)));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') ?? '20', 10)));

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const r = await guard.db
      .prepare(
        `SELECT r.id, r.feature, r.date,
                COALESCE(r.title, r.feature || ' ' || r.date) AS title,
                COUNT(rx.id) AS reaction_count
         FROM reports r
         LEFT JOIN reactions rx ON rx.report_id = r.id
         WHERE r.published = 1 AND r.date >= ?
         GROUP BY r.id
         ORDER BY reaction_count DESC, r.date DESC
         LIMIT ?`
      )
      .bind(since, limit)
      .all<TopReport>();
    return jsonResponse({ reports: r.results ?? [], days, limit });
  } catch (e) {
    console.error('[rankings] query failed', e);
    return jsonError('Rankings query failed', 500);
  }
};
