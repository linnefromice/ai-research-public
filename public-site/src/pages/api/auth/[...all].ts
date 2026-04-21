import type { APIRoute } from 'astro';
import { jsonError } from '../../../lib/api-helpers';

export const prerender = false;

const handleAuth: APIRoute = async (context) => {
  const auth = context.locals.auth;
  if (!auth) {
    return jsonError('Auth service not configured', 503);
  }
  return auth.handler(context.request);
};

export const GET = handleAuth;
export const POST = handleAuth;
