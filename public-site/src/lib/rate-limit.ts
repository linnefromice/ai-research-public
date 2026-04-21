/**
 * 簡易 IP ベース rate limit (D1 経由)
 *
 * - 同一 IP から同一キーへの呼び出しを window 秒内に max 回まで許可
 * - 超過時は 429 を返す Response を返す
 * - ベストエフォート: D1 未設定時は null を返して素通り
 */

export async function rateLimit(
  db: D1Database | undefined,
  request: Request,
  key: string,
  max: number = 10,
  windowSec: number = 60
): Promise<Response | null> {
  if (!db) return null;

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSec;

  try {
    // rate_limit_events テーブルが存在する場合のみ動作 (migration 0016)
    const countResult = await db
      .prepare('SELECT COUNT(*) as cnt FROM rate_limit_events WHERE bucket_key = ? AND created_at >= ?')
      .bind(bucketKey, windowStart)
      .first<{ cnt: number }>();

    const count = countResult?.cnt ?? 0;
    if (count >= max) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'RATE_LIMITED', message: `Too many requests. Try again in ${windowSec}s.` },
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(windowSec) },
      });
    }

    // Record this call
    await db
      .prepare('INSERT INTO rate_limit_events (bucket_key, created_at) VALUES (?, ?)')
      .bind(bucketKey, now)
      .run();

    return null;
  } catch {
    // rate_limit_events テーブル未作成等の場合は素通り
    return null;
  }
}
