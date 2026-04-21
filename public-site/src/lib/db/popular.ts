export interface PopularReport {
  report_id: string;
  title: string;
  feature: string;
  date: string;
  views: number;
  likes: number;
}

/**
 * 人気レポートランキング取得。
 * views (report_views 行数) と likes (reactions.reaction='like' 行数) を
 * LEFT JOIN で一括集計する。各レポートごとに views*likes の直積を避けるため、
 * COUNT(DISTINCT) を使用している。
 */
export async function getPopularReports(
  db: D1Database, sinceDate: string, limit: number,
): Promise<PopularReport[]> {
  const result = await db.prepare(
    `SELECT
       rv.report_id,
       r.title,
       r.feature,
       r.date,
       COUNT(DISTINCT rv.id) as views,
       COUNT(DISTINCT CASE WHEN rx.reaction = 'like' THEN rx.id END) as likes
     FROM report_views rv
     JOIN reports r ON rv.report_id = r.id
     LEFT JOIN reactions rx ON rx.report_id = rv.report_id
     WHERE r.date >= ? AND r.published = 1
     GROUP BY rv.report_id, r.title, r.feature, r.date
     ORDER BY views DESC, likes DESC
     LIMIT ?`,
  ).bind(sinceDate, limit).all<PopularReport>();
  return result.results;
}
