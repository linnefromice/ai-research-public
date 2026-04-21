import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse, jsonError } from '../../../lib/api-helpers';
import { findReaction, deleteReaction, updateReaction, insertReaction } from '../../../lib/db/reactions';

export const prerender = false;

/** POST /api/engage/react — レポート評価（認証必須） */
export const POST: APIRoute = async (context) => {
  const guard = requireAuth(context);
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  let body: { report_id: string; reaction: string };
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.report_id || !['like', 'dislike'].includes(body.reaction)) {
    return jsonError('report_id and reaction (like|dislike) required', 400);
  }

  const existing = await findReaction(db, body.report_id, user.id);
  if (existing) {
    if (existing.reaction === body.reaction) {
      await deleteReaction(db, body.report_id, user.id);
      return jsonResponse({ success: true, action: 'removed' });
    }
    await updateReaction(db, body.report_id, user.id, body.reaction);
    return jsonResponse({ success: true, action: 'updated' });
  }

  await insertReaction(db, body.report_id, user.id, body.reaction);
  return jsonResponse({ success: true, action: 'created' }, 201);
};
