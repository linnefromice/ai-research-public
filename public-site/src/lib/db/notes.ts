export async function findNote(
  db: D1Database, reportId: string, userId: string,
): Promise<{ content: string; updated_at: string } | null> {
  return db.prepare(
    'SELECT content, updated_at FROM report_notes WHERE report_id = ? AND user_id = ?',
  ).bind(reportId, userId).first<{ content: string; updated_at: string }>();
}

export async function upsertNote(
  db: D1Database, reportId: string, userId: string, content: string,
): Promise<void> {
  await db.prepare(
    `INSERT INTO report_notes (report_id, user_id, content) VALUES (?, ?, ?)
     ON CONFLICT(report_id, user_id) DO UPDATE SET content = excluded.content, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  ).bind(reportId, userId, content).run();
}

export async function deleteNote(
  db: D1Database, reportId: string, userId: string,
): Promise<void> {
  await db.prepare(
    'DELETE FROM report_notes WHERE report_id = ? AND user_id = ?',
  ).bind(reportId, userId).run();
}

export interface NoteWithReport {
  report_id: string;
  title: string;
  feature: string;
  date: string;
  content: string;
  updated_at: string;
}

/**
 * 指定ユーザーのメモを reports テーブルと JOIN で取得。
 * published フラグに関係なく、自分が書いたメモは全て表示する
 * （自分の記録なのでレポートが非公開でも参照できる方が自然）。
 */
export async function listNotesByUser(
  db: D1Database, userId: string, limit = 100,
): Promise<NoteWithReport[]> {
  const result = await db.prepare(
    `SELECT n.report_id, r.title, r.feature, r.date, n.content, n.updated_at
     FROM report_notes n
     JOIN reports r ON n.report_id = r.id
     WHERE n.user_id = ?
     ORDER BY n.updated_at DESC
     LIMIT ?`,
  ).bind(userId, limit).all<NoteWithReport>();
  return result.results;
}
