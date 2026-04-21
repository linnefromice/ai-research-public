import type { APIRoute } from 'astro';
import { requireDB, jsonResponse, jsonError } from '../../../lib/api-helpers';

export const prerender = false;

/**
 * GET /api/visibility/:feature
 *
 * 当該 feature の非公開レポート ID 一覧を返す。クライアント側は静的に
 * 描画済みの一覧カードを、このレスポンスに含まれる ID で display:none に
 * することで publish/unpublish を再ビルドなしで反映する。
 *
 * Response: { unpublished: string[] }
 */
export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;
  const { db } = guard;

  const feature = context.params.feature;
  if (!feature) return jsonError('feature required', 400);

  const rows = await db
    .prepare('SELECT id FROM reports WHERE feature = ? AND published = 0 LIMIT 1000')
    .bind(feature)
    .all<{ id: string }>();

  return jsonResponse(
    { unpublished: rows.results.map((r: { id: string }) => r.id) },
    200,
  );
};
