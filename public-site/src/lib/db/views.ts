export async function recordView(
  db: D1Database,
  reportId: string,
  userId: string | null,
  fingerprint: string | null,
): Promise<'viewed' | 'already_viewed'> {
  if (userId) {
    const exists = await db.prepare(
      'SELECT 1 FROM report_views WHERE report_id = ? AND user_id = ?',
    ).bind(reportId, userId).first();
    if (exists) return 'already_viewed';
    await db.prepare(
      'INSERT INTO report_views (report_id, user_id) VALUES (?, ?)',
    ).bind(reportId, userId).run();
  } else if (fingerprint) {
    const exists = await db.prepare(
      'SELECT 1 FROM report_views WHERE report_id = ? AND fingerprint = ?',
    ).bind(reportId, fingerprint).first();
    if (exists) return 'already_viewed';
    await db.prepare(
      'INSERT INTO report_views (report_id, fingerprint) VALUES (?, ?)',
    ).bind(reportId, fingerprint).run();
  } else {
    await db.prepare(
      'INSERT INTO report_views (report_id) VALUES (?)',
    ).bind(reportId).run();
  }
  return 'viewed';
}

export async function countViews(
  db: D1Database, reportId: string,
): Promise<number> {
  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM report_views WHERE report_id = ?',
  ).bind(reportId).first<{ count: number }>();
  return row?.count ?? 0;
}
