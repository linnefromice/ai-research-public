import { env } from 'cloudflare:workers';
import type { APIContext } from 'astro';

/** Cloudflare env bindings — DB やシークレットは未設定の可能性があるため Partial */
export type CfEnv = Partial<CfBindings>;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), { status, headers: JSON_HEADERS });
}

export function getCfEnv(): CfEnv {
  return env as unknown as CfEnv;
}

type AuthResult =
  | { ok: true; user: NonNullable<App.Locals['user']>; db: D1Database }
  | { ok: false; response: Response };

export function requireAuth(context: APIContext): AuthResult {
  const user = context.locals.user;
  if (!user) {
    return { ok: false, response: jsonError('Login required', 401) };
  }
  const cfEnv = getCfEnv();
  if (!cfEnv?.DB) {
    return { ok: false, response: jsonError('Service unavailable', 503) };
  }
  return { ok: true, user, db: cfEnv.DB };
}

type DbResult =
  | { ok: true; db: D1Database; user: App.Locals['user'] }
  | { ok: false; response: Response };

/**
 * DB の存在チェックを行い、locals.user（任意）もまとめて返す。
 * 認証は必須ではないが、user 情報を参照する API（stats, view）向け。
 */
export function requireDB(context: APIContext): DbResult {
  const cfEnv = getCfEnv();
  if (!cfEnv?.DB) {
    return { ok: false, response: jsonError('Service unavailable', 503) };
  }
  return { ok: true, db: cfEnv.DB, user: context.locals.user };
}
