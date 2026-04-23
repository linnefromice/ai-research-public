/**
 * Runtime D1 helpers for the daily report preview feature.
 *
 * Build-time collection access lives in d1-client.ts. These are for
 * SSR endpoints that read the current D1 state.
 *
 * Design: docs/plans/2026-04-23-daily-preview-d1-design.md (private)
 */

export interface LatestReportRow {
  id: string;
  feature: string;
  date: string;
  title: string | null;
  summary: string | null;
  language: string | null;
}

export interface ReportContentRow extends LatestReportRow {
  content: string | null;
  original_date: string | null;
}

/**
 * Return today's daily reports that are published and NOT deep-research.
 * Sorted newest first.
 */
export async function fetchLatestDailyReports(
  db: D1Database,
  todayIso: string
): Promise<LatestReportRow[]> {
  const stmt = db.prepare(
    `SELECT id, feature, date, title, summary, language
     FROM reports
     WHERE date = ?
       AND published = 1
       AND feature != 'deep-research'
     ORDER BY feature ASC`
  ).bind(todayIso);
  const res = await stmt.all<LatestReportRow>();
  return res.results ?? [];
}

/**
 * Fetch one report by (feature, date) pair. Handles language variants:
 * tries `<feature>/<date>/ja` first (JP audience default), falls back
 * to `<feature>/<date>/en`, then plain `<feature>/<date>`.
 */
export async function fetchReportByFeatureDate(
  db: D1Database,
  feature: string,
  date: string
): Promise<ReportContentRow | null> {
  const candidates = [
    `${feature}/${date}/ja`,
    `${feature}/${date}/en`,
    `${feature}/${date}`,
  ];
  for (const id of candidates) {
    const row = await db
      .prepare(
        `SELECT id, feature, date, title, summary, language, content, original_date
         FROM reports
         WHERE id = ? AND published = 1`
      )
      .bind(id)
      .first<ReportContentRow>();
    if (row) return row;
  }
  return null;
}

/**
 * "YYYY-MM-DD" in JST. Uses Intl API so it works on the Workers runtime
 * without importing a date library.
 */
export function todayJST(): string {
  const now = new Date();
  // Cloudflare Workers uses UTC; shift to JST.
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
