import { defineMiddleware } from 'astro:middleware';
import { createAuth } from './lib/auth';
import { getCfEnv } from './lib/api-helpers';

/** セッションチェックが必要な API パスプレフィックス */
const AUTH_REQUIRED_PREFIXES = ['/api/auth/', '/api/engage/react', '/api/engage/note', '/api/engage/notes/'];

/** セッション情報があると便利な API（任意） */
const AUTH_OPTIONAL_PREFIXES = ['/api/engage/stats', '/api/engage/view'];

function needsAuth(path: string): 'required' | 'optional' | 'none' {
  if (AUTH_REQUIRED_PREFIXES.some(p => path.startsWith(p))) return 'required';
  if (AUTH_OPTIONAL_PREFIXES.some(p => path.startsWith(p))) return 'optional';
  return 'none';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = new URL(context.request.url).pathname;

  context.locals.user = null;
  context.locals.session = null;
  context.locals.auth = null;

  const authLevel = path.startsWith('/api/') ? needsAuth(path) : 'none';

  if (authLevel !== 'none') {
    try {
      const cfEnv = getCfEnv();
      if (cfEnv?.DB && cfEnv?.BETTER_AUTH_SECRET) {
        const auth = createAuth(cfEnv);
        context.locals.auth = auth;
        const result = await auth.api.getSession({ headers: context.request.headers });
        if (result?.user) {
          context.locals.user = {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            image: result.user.image ?? undefined,
          };
        }
        if (result?.session) {
          context.locals.session = {
            id: result.session.id,
            userId: result.session.userId,
            token: result.session.token,
            expiresAt: result.session.expiresAt.toString(),
          };
        }
      }
    } catch (e) {
      console.warn('[middleware] Session check failed:', e instanceof Error ? e.message : e);
    }
  }

  const response = await next();

  // Astro は getStaticPaths 付きの .md.ts を prerender して dist/client/*.md に
  // 静的配置するが、そのとき APIRoute handler で設定した Content-Type charset や
  // Content-Disposition は破棄される。ランタイムの static 配信が拡張子ベースの
  // MIME (text/markdown) のみを返すと Japanese ブラウザが legacy encoding と
  // 誤認して mojibake が発生する。ここで .md レスポンスに charset を再注入する。
  if (path.endsWith('.md')) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.startsWith('text/markdown') && !/charset/i.test(contentType)) {
      const patched = new Response(response.body, response);
      patched.headers.set('content-type', 'text/markdown; charset=utf-8');
      // ブラウザでダウンロードにならずそのまま表示されるよう明示
      if (!patched.headers.has('content-disposition')) {
        const filename = path.slice(path.lastIndexOf('/') + 1);
        patched.headers.set('content-disposition', `inline; filename="${filename}"`);
      }
      return patched;
    }
  }

  return response;
});
