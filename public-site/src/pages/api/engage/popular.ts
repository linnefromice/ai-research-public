import type { APIRoute } from 'astro';
import { requireDB, jsonResponse } from '../../../lib/api-helpers';
import { getPopularReports } from '../../../lib/db/popular';

export const prerender = false;

/** GET /api/engage/popular?days=7&limit=10 — 人気レポートランキング（認証不要） */
export const GET: APIRoute = async (context) => {
  const guard = requireDB(context);
  if (!guard.ok) return guard.response;
  const { db } = guard;

  const url = new URL(context.request.url);
  const rawDays = parseInt(url.searchParams.get('days') ?? '7', 10);
  const days = isNaN(rawDays) ? 7 : rawDays;
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '10', 10);
  const limit = Math.min(isNaN(rawLimit) ? 10 : rawLimit, 50);
  const sinceDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const data = await getPopularReports(db, sinceDate, limit);
  return jsonResponse({ success: true, data });
};
