/**
 * D1 API クライアント
 *
 * ビルド時に D1 から published 状態を取得し、非公開レポートをフィルタする。
 * D1_API_URL/KEY 未設定時や取得失敗時は空セット (= フィルタなし = 全件表示) を返す。
 * ビルド中は結果をキャッシュし、複数ページで同じ fetch を繰り返さない。
 */

interface D1Report {
  id: string;
  feature: string;
  date: string;
  session: string;
  published: number;
  summary: string | null;
}

interface D1Response {
  success: boolean;
  data: D1Report[];
  meta: { total: number; limit: number; offset: number };
}

// ── ビルド時キャッシュ ────────────────────────────────────────────────
// Astro SSG ビルドは単一プロセスで全ページを生成するため、
// モジュールレベルの変数でキャッシュが有効。
let cachedUnpublishedIds: Set<string> | null = null;

/** D1 から非公開レポートの ID セットを取得（ビルド中キャッシュ） */
export async function getUnpublishedIds(): Promise<Set<string>> {
  if (cachedUnpublishedIds !== null) {
    return cachedUnpublishedIds;
  }

  const apiUrl = import.meta.env.D1_API_URL || process.env.D1_API_URL;
  const apiKey = import.meta.env.D1_API_KEY || process.env.D1_API_KEY;

  if (!apiUrl || !apiKey) {
    cachedUnpublishedIds = new Set();
    return cachedUnpublishedIds;
  }

  try {
    const response = await fetch(`${apiUrl}/api/reports?published=false&limit=1000`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[d1-client] API returned ${response.status}`);
      cachedUnpublishedIds = new Set();
      return cachedUnpublishedIds;
    }

    const data = (await response.json()) as D1Response;
    cachedUnpublishedIds = new Set(data.data.map((r) => r.id));
    return cachedUnpublishedIds;
  } catch (e) {
    console.warn(`[d1-client] Failed to fetch from D1: ${e}`);
    cachedUnpublishedIds = new Set();
    return cachedUnpublishedIds;
  }
}

/** D1 からレポートメタデータを取得（summary 付き、ビルド中キャッシュ） */
let cachedReportMeta: Map<string, D1Report> | null = null;

export async function getReportMeta(): Promise<Map<string, D1Report>> {
  if (cachedReportMeta !== null) {
    return cachedReportMeta;
  }

  const apiUrl = import.meta.env.D1_API_URL || process.env.D1_API_URL;
  const apiKey = import.meta.env.D1_API_KEY || process.env.D1_API_KEY;

  if (!apiUrl || !apiKey) {
    cachedReportMeta = new Map();
    return cachedReportMeta;
  }

  try {
    const response = await fetch(`${apiUrl}/api/reports?published=true&limit=1000`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`[d1-client] API returned ${response.status}`);
      cachedReportMeta = new Map();
      return cachedReportMeta;
    }

    const data = (await response.json()) as D1Response;
    cachedReportMeta = new Map(data.data.map((r) => [r.id, r]));
    return cachedReportMeta;
  } catch (e) {
    console.warn(`[d1-client] Failed to fetch report meta: ${e}`);
    cachedReportMeta = new Map();
    return cachedReportMeta;
  }
}

/** D1 から全レポートのタグを一括取得（ビルド中キャッシュ、1回の fetch） */
interface ReportTag {
  tag: string;
  tag_type: string;
}

let cachedReportTags: Map<string, ReportTag[]> | null = null;

export async function getAllReportTags(): Promise<Map<string, ReportTag[]>> {
  if (cachedReportTags !== null) {
    return cachedReportTags;
  }

  const apiUrl = import.meta.env.D1_API_URL || process.env.D1_API_URL;
  const apiKey = import.meta.env.D1_API_KEY || process.env.D1_API_KEY;

  if (!apiUrl || !apiKey) {
    cachedReportTags = new Map();
    return cachedReportTags;
  }

  try {
    const response = await fetch(`${apiUrl}/api/tags/bulk`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[d1-client] Bulk tags API returned ${response.status}`);
      cachedReportTags = new Map();
      return cachedReportTags;
    }

    const data = (await response.json()) as { data: Record<string, ReportTag[]> };
    cachedReportTags = new Map(Object.entries(data.data));
    return cachedReportTags;
  } catch (e) {
    console.warn(`[d1-client] Failed to fetch bulk tags: ${e}`);
    cachedReportTags = new Map();
    return cachedReportTags;
  }
}

/**
 * レポート ID を生成 (ファイルベースの ID → D1 ID に変換)
 *
 * Multilingual features have slug like `2026-04-12ja` / `2026-04-12en`
 * (Astro strips the dot from `.ja.md` / `.en.md`). The pipeline stores the
 * language as a separate path segment in D1: `feature/2026-04-12/ja`. We
 * insert the slash here so lookups against the D1-returned map hit.
 */
import { detectLang } from './multilingual';

export function toD1Id(feature: string, slug: string): string {
  const lang = detectLang(slug);
  if (lang) {
    // Strip trailing `.ja`/`.en` or bare `ja`/`en` and re-join with a slash.
    const stem = slug.replace(/\.?(ja|en)$/, '');
    return `${feature}/${stem}/${lang}`;
  }
  return `${feature}/${slug}`;
}
