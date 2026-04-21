/**
 * Cloudflare Pages Functions — infra Worker リクエストプロキシ
 *
 * admin-site は Cloudflare Access で保護されているため、この Function に到達する
 * 時点で認証済み。サーバ側で API_KEY を付与して infra Worker (openclaw-api) に
 * 転送することで、ブラウザに認証情報を一切持たせずに済むようにする。
 *
 * 対応経路:
 *   GET/POST/PATCH/DELETE /api/*  →  ${INFRA_API_URL}/api/*
 *
 * 必須の環境変数 (Cloudflare Pages プロジェクトの Settings > Variables and Secrets で設定):
 *   - INFRA_API_URL : infra Worker の Base URL (例: https://openclaw-api.linnefromice.workers.dev)
 *   - API_KEY       : infra Worker の Bearer token (Encrypted 指定)
 */

interface Env {
  INFRA_API_URL: string;
  API_KEY: string;
}

interface EventContext {
  request: Request;
  env: Env;
}

export async function onRequest({ request, env }: EventContext): Promise<Response> {
  if (!env.INFRA_API_URL || !env.API_KEY) {
    return jsonError(
      'CONFIG_ERROR',
      'INFRA_API_URL / API_KEY are not configured on the Pages project',
      503,
    );
  }

  // `params.path` を join すると encodeURIComponent された "/" (報告書 ID に含まれる
  // feature/date) が復元されずパスが壊れる可能性がある。pathname をそのまま使えば
  // WHATWG URL が percent-encoding を保持するので、決定論的に正しく転送できる。
  const { pathname, search } = new URL(request.url);
  const target = `${env.INFRA_API_URL.replace(/\/$/, '')}${pathname}${search}`;

  // ブラウザから来たヘッダを丸ごと転送しない (Cookie 等がそのまま infra に渡ると
  // 意図せぬ認証コンテキストになる)。必要最小限だけ渡し、Authorization は
  // サーバ側シークレットで上書きする。
  const forwarded = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) forwarded.set('Content-Type', contentType);
  forwarded.set('Authorization', `Bearer ${env.API_KEY}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers: forwarded, body });
  } catch (e) {
    // 運用時の切り分けを容易にするためログに残す。Access 経由でしか到達しないので
    // 攻撃者へのヒントにはならない。
    console.error('[api-proxy] upstream fetch failed:', target, e instanceof Error ? e.message : e);
    return jsonError('UPSTREAM_ERROR', 'Failed to reach infra API', 502);
  }

  // infra からのレスポンスは同一オリジンで返すので CORS ヘッダ等は付けず
  // Content-Type のみ引き継ぐ。
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

function jsonError(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}
