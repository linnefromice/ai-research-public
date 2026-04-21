import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../../lib/api-helpers';
import { listNotesByUser } from '../../../../lib/db/notes';

export const prerender = false;

/** GET /api/engage/notes/list — ログインユーザーのメモ一覧（認証必須） */
export const GET: APIRoute = async (context) => {
  const guard = requireAuth(context);
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  const notes = await listNotesByUser(db, user.id);
  return jsonResponse({ success: true, data: notes });
};
