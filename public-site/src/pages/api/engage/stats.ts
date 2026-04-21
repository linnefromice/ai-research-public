import type { APIRoute } from 'astro';
import { requireDB, jsonResponse, jsonError } from '../../../lib/api-helpers';
import { countViews } from '../../../lib/db/views';
import { countByType, findReaction } from '../../../lib/db/reactions';

export const prerender = false;

/** GET /api/engage/stats?report_id=... — レポートの統計（認証不要） */
export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;
  const { db, user } = guard;

  const reportId = new URL(context.request.url).searchParams.get('report_id');
  if (!reportId) {
    return jsonError('report_id required', 400);
  }

  const userId = user?.id;
  const [views, likes, dislikes, userReaction] = await Promise.all([
    countViews(db, reportId),
    countByType(db, reportId, 'like'),
    countByType(db, reportId, 'dislike'),
    userId ? findReaction(db, reportId, userId) : Promise.resolve(null),
  ]);

  return jsonResponse({
    success: true,
    data: {
      views,
      likes,
      dislikes,
      user_reaction: userReaction?.reaction ?? null,
    },
  });
};
