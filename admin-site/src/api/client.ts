/**
 * infra Worker API クライアント (admin-site 用)
 *
 * admin-site は Cloudflare Access + 同一オリジンの Pages Function プロキシ
 * (functions/api/[[path]].ts) 経由で infra に到達するため、ブラウザ側は
 * 相対パス `/api/*` をそのまま fetch すればよい。API URL / API Key は
 * Pages Function の環境変数にのみ存在し、ブラウザには一切持たせない。
 */

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || `API error: ${res.status}`);
  }
  return data;
}

// Reports
export interface Report {
  id: string;
  feature: string;
  date: string;
  session: string;
  title: string;
  engine: string;
  article_count: number;
  published: number;
  summary: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export async function listReports(params: { feature?: string; published?: string; limit?: number; offset?: number } = {}) {
  const query = new URLSearchParams();
  if (params.feature) query.set('feature', params.feature);
  if (params.published) query.set('published', params.published);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return apiFetch<{ data: Report[]; meta: { total: number; limit: number; offset: number } }>(`/api/reports?${query}`);
}

export async function getReport(id: string) {
  return apiFetch<{ data: Report }>(`/api/reports/${encodeURIComponent(id)}`);
}

export async function updateReport(id: string, updates: { published?: boolean; summary?: string; title?: string }) {
  return apiFetch<{ data: Report }>(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteReport(id: string) {
  return apiFetch<{ data: { deleted: boolean } }>(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// Tags
export interface ReportTag {
  id: number;
  report_id: string;
  tag: string;
  tag_type: string;
  created_at: string;
}

export async function getReportTags(reportId: string) {
  return apiFetch<{ data: ReportTag[] }>(`/api/reports/${encodeURIComponent(reportId)}/tags`);
}

export async function addTag(reportId: string, tag: string, tagType: string = 'keyword') {
  return apiFetch<{ data: ReportTag }>(`/api/reports/${encodeURIComponent(reportId)}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tag, tag_type: tagType }),
  });
}

export async function removeTag(reportId: string, tag: string) {
  return apiFetch<{ data: { deleted: boolean } }>(
    `/api/reports/${encodeURIComponent(reportId)}/tags?tag=${encodeURIComponent(tag)}`,
    { method: 'DELETE' }
  );
}

// Trends
export interface TagCount {
  tag: string;
  tag_type: string;
  report_count: number;
}

export async function getTrends(days: number = 7) {
  return apiFetch<{ data: TagCount[] }>(`/api/trends/tags?days=${days}&limit=30`);
}

// Related Reports
export interface RelatedReport {
  report_id: string;
  feature: string;
  date: string;
  title: string;
  shared_tags: string[];
  shared_count: number;
}

export async function getRelatedReports(reportId: string, limit: number = 5) {
  return apiFetch<{ data: RelatedReport[] }>(`/api/reports/${encodeURIComponent(reportId)}/related?limit=${limit}`);
}

// Batch tag add
export async function addTagsBatch(reportId: string, tags: { tag: string; tag_type: string }[]) {
  return apiFetch<{ data: { added: number; duplicates: number } }>(`/api/reports/${encodeURIComponent(reportId)}/tags/batch`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}

// Research Requests
export type ResearchRequestStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ResearchRequest {
  id: string;
  topic: string;
  goal_content: string;
  engine: string;
  status: ResearchRequestStatus;
  channel: string | null;
  channel_metadata: Record<string, unknown> | null;
  report_url: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listResearchRequests(params: { status?: ResearchRequestStatus; limit?: number; offset?: number; order?: 'asc' | 'desc' } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.order)  query.set('order', params.order);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));
  return apiFetch<{ data: ResearchRequest[]; meta: { total: number; limit: number; offset: number } }>(
    `/api/research-requests?${query}`
  );
}

export async function deleteResearchRequest(id: string) {
  return apiFetch<{ data: { id: string } }>(`/api/research-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface CreateResearchRequestInput {
  topic: string;
  goal_content: string;
  engine?: string;
  channel?: string;
  channel_metadata?: Record<string, unknown> | null;
}

export async function createResearchRequest(input: CreateResearchRequestInput) {
  return apiFetch<{ data: ResearchRequest }>(`/api/research-requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// failed → pending に戻して再試行
export async function retryResearchRequest(id: string) {
  return apiFetch<{ data: ResearchRequest }>(
    `/api/research-requests/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'pending' }) }
  );
}

// Pipeline Events
export type EventSeverity = 'info' | 'warning' | 'error';

export interface PipelineEvent {
  id: string;
  feature: string | null;
  event_type: string;
  severity: EventSeverity;
  title: string;
  details: string | null;
  resolved: number;
  created_at: string;
}

export async function listEvents(params: {
  resolved?: boolean;
  severity?: EventSeverity;
  feature?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.resolved !== undefined) searchParams.set('resolved', String(params.resolved));
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.feature) searchParams.set('feature', params.feature);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return apiFetch<{ data: PipelineEvent[]; meta: { total: number; limit: number; offset: number } }>(
    `/api/events${qs ? `?${qs}` : ''}`
  );
}

export async function resolveEvent(id: string) {
  return apiFetch<{ data: PipelineEvent }>(
    `/api/events/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ resolved: true }) }
  );
}
