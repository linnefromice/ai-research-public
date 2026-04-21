/// <reference types="astro/client" />

type CfBindings = {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
};

type Runtime = import('@astrojs/cloudflare').Runtime<CfBindings>;

type AuthInstance = ReturnType<typeof import('./lib/auth').createAuth>;

declare namespace App {
  interface Locals extends Runtime {
    user: { id: string; name: string; email: string; image?: string } | null;
    session: { id: string; userId: string; token: string; expiresAt: string } | null;
    auth: AuthInstance | null;
  }
}
