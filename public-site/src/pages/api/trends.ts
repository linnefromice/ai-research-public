/**
 * Top trending tags + per-day timelines for the past N days.
 * Replaces the SSR rendering in pages/trends.astro (cf-astro-patterns §16).
 */
import type { APIRoute } from 'astro';
import { jsonError, jsonResponse, requireDB } from '../../lib/api-helpers';

export const prerender = false;

interface TagTimeline {
  tag: string;
  data: { date: string; count: number }[];
}

export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;

  const url = new URL(context.request.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') ?? '30', 10)));
  const tagLimit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') ?? '8', 10)));

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const topTagsRes = await guard.db
      .prepare(
        `SELECT rt.tag, COUNT(DISTINCT rt.report_id) AS cnt
         FROM report_tags rt
         JOIN reports r ON r.id = rt.report_id
         WHERE rt.tag_type = 'keyword' AND r.date >= ? AND r.published = 1
         GROUP BY rt.tag
         ORDER BY cnt DESC
         LIMIT ?`
      )
      .bind(since, tagLimit)
      .all<{ tag: string; cnt: number }>();

    const tags = (topTagsRes.results ?? []).map((r) => r.tag);
    const timelines: TagTimeline[] = [];

    for (const tag of tags) {
      const tlRes = await guard.db
        .prepare(
          `SELECT r.date, COUNT(DISTINCT rt.report_id) AS count
           FROM report_tags rt
           JOIN reports r ON r.id = rt.report_id
           WHERE rt.tag = ? AND rt.tag_type = 'keyword' AND r.date >= ? AND r.published = 1
           GROUP BY r.date
           ORDER BY r.date`
        )
        .bind(tag, since)
        .all<{ date: string; count: number }>();
      timelines.push({ tag, data: tlRes.results ?? [] });
    }

    return jsonResponse({ tags: timelines, days });
  } catch (e) {
    console.error('[trends] query failed', e);
    return jsonError('Trends query failed', 500);
  }
};
