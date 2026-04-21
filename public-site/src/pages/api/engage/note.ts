import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse, jsonError } from '../../../lib/api-helpers';
import { findNote, upsertNote, deleteNote } from '../../../lib/db/notes';

export const prerender = false;

/** GET /api/engage/note?report_id=... — メモ取得（認証必須） */
export const GET: APIRoute = async (context) => {
  const guard = requireAuth(context);
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  const reportId = new URL(context.request.url).searchParams.get('report_id');
  if (!reportId) {
    return jsonError('report_id required', 400);
  }

  const note = await findNote(db, reportId, user.id);
  return jsonResponse({ success: true, data: note });
};

/** PUT /api/engage/note — メモ保存（upsert、認証必須） */
export const PUT: APIRoute = async (context) => {
  const guard = requireAuth(context);
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  let body: { report_id: string; content: string };
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.report_id || typeof body.content !== 'string') {
    return jsonError('report_id and content required', 400);
  }

  await upsertNote(db, body.report_id, user.id, body.content);
  return jsonResponse({ success: true });
};

/** DELETE /api/engage/note?report_id=... — メモ削除（認証必須） */
export const DELETE: APIRoute = async (context) => {
  const guard = requireAuth(context);
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  const reportId = new URL(context.request.url).searchParams.get('report_id');
  if (!reportId) {
    return jsonError('report_id required', 400);
  }

  await deleteNote(db, reportId, user.id);
  return jsonResponse({ success: true });
};
