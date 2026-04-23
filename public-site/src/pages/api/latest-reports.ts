/**
 * Returns today's published daily reports from D1 (deep-research excluded).
 * Used by the LatestReportsBanner on the dashboard to surface reports that
 * may not yet be reflected in the static build.
 *
 * Design: docs/plans/2026-04-23-daily-preview-d1-design.md (private)
 */
import type { APIRoute } from 'astro';
import { jsonError, jsonResponse, requireDB } from '../../lib/api-helpers';
import { fetchLatestDailyReports, todayJST } from '../../lib/runtime-reports';

export const prerender = false;

const CACHE_CONTROL = 'public, max-age=60, s-maxage=60';

export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;

  try {
    const today = todayJST();
    const rows = await fetchLatestDailyReports(guard.db, today);

    // Dedupe multilingual variants: prefer ja, drop en when ja exists for same feature/date.
    const byKey = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      const key = `${r.feature}/${r.date}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, r);
        continue;
      }
      // Prefer ja over en, otherwise keep first.
      if (r.language === 'ja' && existing.language !== 'ja') {
        byKey.set(key, r);
      }
    }

    const reports = [...byKey.values()].map((r) => ({
      id: r.id,
      feature: r.feature,
      date: r.date,
      title: r.title,
      summary: r.summary,
      language: r.language,
      static_url: `/${r.feature}/${r.date}/`,
      preview_url: `/latest/${r.feature}/${r.date}/`,
    }));

    return new Response(JSON.stringify({ reports, today }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': CACHE_CONTROL,
      },
    });
  } catch (e) {
    console.error('latest-reports error', e);
    return jsonError('Failed to fetch latest reports', 500);
  }
};
