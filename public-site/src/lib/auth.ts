import { betterAuth } from 'better-auth';
import { kyselyAdapter } from '@better-auth/kysely-adapter';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

/**
 * BetterAuth サーバーインスタンスを生成する。
 * Kysely + D1Dialect で Cloudflare D1 に接続。
 */
export function createAuth(env: {
  DB: D1Database;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string;
}) {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET environment variable is required');
  }
  if (!env.DB) {
    throw new Error('D1 database binding (DB) is required');
  }

  const db = new Kysely({ dialect: new D1Dialect({ database: env.DB }) });

  return betterAuth({
    database: kyselyAdapter(db, { type: 'sqlite' }),
    baseURL: env.BETTER_AUTH_URL || 'https://auto-research.linnefromice.workers.dev',
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      } : {}),
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      } : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      // 1日ごとにセッショントークンを自動ローテーション
      // updateAge を超えると BetterAuth が新しいトークンを発行し、
      // expiresIn もリセットされる (active user の session 延長 + 漏洩リスク低減)
      updateAge: 60 * 60 * 24,
    },
  });
}
