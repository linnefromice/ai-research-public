import type { APIRoute } from 'astro';
import { getCfEnv } from '../../lib/api-helpers';
import { features } from '../../features';

export const prerender = false;

interface D1Report {
  id: string;
  feature: string;
  date: string;
  title: string;
  summary: string | null;
}

interface D1Response {
  success: boolean;
  data: D1Report[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRssXml(reports: D1Report[], title: string, link: string, description: string): string {
  const featureMap = new Map(features.map(f => [f.slug, f]));
  const items = reports.map(r => {
    const feature = featureMap.get(r.feature);
    const label = feature?.label ?? r.feature;
    const pubDate = new Date(`${r.date}T00:00:00Z`).toUTCString();
    const itemLink = `${link}/${r.feature}/${r.date}/`;
    const desc = r.summary ? escapeXml(r.summary) : `${escapeXml(label)} report for ${r.date}`;
    return `    <item>
      <title>${escapeXml(r.title || `${label} - ${r.date}`)}</title>
      <link>${itemLink}</link>
      <guid>${itemLink}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      <category>${escapeXml(label)}</category>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${link}</link>
    <description>${escapeXml(description)}</description>
    <language>ja</language>
    <atom:link href="${link}/feed/" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`;
}

export const GET: APIRoute = async (_context) => {
  const cfEnv = getCfEnv();
  const db = cfEnv?.DB;

  if (!db) {
    return new Response('RSS feed unavailable', { status: 503 });
  }

  let reports: D1Report[] = [];
  try {
    const result = await db
      .prepare(
        `SELECT id, feature, date, title, summary
         FROM reports
         WHERE published = 1
         ORDER BY date DESC
         LIMIT 30`
      )
      .all<D1Report>();
    reports = result.results ?? [];
  } catch (e) {
    console.warn('[feed] query failed:', e);
    return new Response('RSS feed temporarily unavailable', { status: 503 });
  }
  const siteUrl = 'https://openclaw-public.pages.dev';
  const xml = buildRssXml(reports, 'OpenClaw Reports', siteUrl, 'AI-powered daily news reports');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
