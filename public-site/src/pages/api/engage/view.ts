import type { APIRoute } from 'astro';
import { requireDB, jsonResponse, jsonError } from '../../../lib/api-helpers';
import { recordView } from '../../../lib/db/views';

export const prerender = false;

/** POST /api/engage/view — 閲覧数カウント（匿名可） */
export const POST: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;
  const { db, user } = guard;

  let body: { report_id: string; fingerprint?: string };
  try {
    body = await context.request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.report_id) {
    return jsonError('report_id required', 400);
  }

  const userId = user?.id ?? null;
  const fingerprint = body.fingerprint ?? null;
  const action = await recordView(db, body.report_id, userId, fingerprint);

  return jsonResponse({ success: true, action }, action === 'viewed' ? 201 : 200);
};
