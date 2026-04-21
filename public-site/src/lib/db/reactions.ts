export async function findReaction(
  db: D1Database, reportId: string, userId: string,
): Promise<{ reaction: string } | null> {
  return db.prepare(
    'SELECT reaction FROM reactions WHERE report_id = ? AND user_id = ?',
  ).bind(reportId, userId).first<{ reaction: string }>();
}

export async function deleteReaction(
  db: D1Database, reportId: string, userId: string,
): Promise<void> {
  await db.prepare(
    'DELETE FROM reactions WHERE report_id = ? AND user_id = ?',
  ).bind(reportId, userId).run();
}

export async function updateReaction(
  db: D1Database, reportId: string, userId: string, reaction: string,
): Promise<void> {
  await db.prepare(
    "UPDATE reactions SET reaction = ?, created_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE report_id = ? AND user_id = ?",
  ).bind(reaction, reportId, userId).run();
}

export async function insertReaction(
  db: D1Database, reportId: string, userId: string, reaction: string,
): Promise<void> {
  await db.prepare(
    'INSERT INTO reactions (report_id, user_id, reaction) VALUES (?, ?, ?)',
  ).bind(reportId, userId, reaction).run();
}

export async function countByType(
  db: D1Database, reportId: string, type: 'like' | 'dislike',
): Promise<number> {
  const row = await db.prepare(
    'SELECT COUNT(*) as count FROM reactions WHERE report_id = ? AND reaction = ?',
  ).bind(reportId, type).first<{ count: number }>();
  return row?.count ?? 0;
}
