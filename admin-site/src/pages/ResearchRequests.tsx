import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  listResearchRequests,
  deleteResearchRequest,
  createResearchRequest,
  retryResearchRequest,
  type ResearchRequest,
  type ResearchRequestStatus,
} from '../api/client';
import { StatsGrid } from '../components/StatsGrid';
import { researchTemplates, extractPlaceholders, type TemplateMeta } from '../lib/research-templates';

const TOPIC_REGEX = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/;

const DEFAULT_TEMPLATE_ID = 'blank';

type StatusFilter = '' | ResearchRequestStatus;

const STATUS_OPTIONS: StatusFilter[] = ['', 'pending', 'running', 'completed', 'failed'];

function statusBadgeClass(status: ResearchRequestStatus): string {
  switch (status) {
    case 'completed': return 'badge badge-success';
    case 'failed':    return 'badge badge-danger';
    case 'running':   return 'badge';
    case 'pending':   return 'badge';
  }
}

function statusBadgeStyle(status: ResearchRequestStatus): CSSProperties | undefined {
  switch (status) {
    case 'running': return { background: 'var(--admin-primary)', color: '#fff' };
    case 'pending': return { background: 'var(--admin-border)', color: 'var(--admin-text-muted)' };
    default: return undefined;
  }
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatChannel(req: ResearchRequest): string {
  if (!req.channel) return 'API';
  const meta = req.channel_metadata;
  if (req.channel === 'telegram' && meta && typeof meta.chat_id === 'string') {
    return `telegram (${meta.chat_id})`;
  }
  return req.channel;
}

export function ResearchRequests() {
  const [requests, setRequests] = useState<ResearchRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const limit = 30;

  // Create form state
  // 注: Deep Research は Claude 固定 (Ollama は web 検索不可で深い調査に不向き)。
  // UI でも engine セレクタは表示しない。
  const defaultTemplate = useMemo<TemplateMeta>(
    () => researchTemplates.find(t => t.id === DEFAULT_TEMPLATE_ID) ?? researchTemplates[0],
    [],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplate.id);
  const [newGoal, setNewGoal] = useState(defaultTemplate.body);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedTemplate = useMemo<TemplateMeta>(
    () => researchTemplates.find(t => t.id === selectedTemplateId) ?? defaultTemplate,
    [selectedTemplateId, defaultTemplate],
  );

  const unresolvedPlaceholders = useMemo(() => extractPlaceholders(newGoal), [newGoal]);

  const resetForm = () => {
    setNewTopic('');
    setSelectedTemplateId(defaultTemplate.id);
    setNewGoal(defaultTemplate.body);
    setFormError(null);
  };

  const selectTemplate = (tpl: TemplateMeta) => {
    if (tpl.id === selectedTemplateId) return;
    // 現在の textarea が選択中テンプレ body と異なる = 編集済み。confirm してから破棄。
    if (newGoal !== selectedTemplate.body && !confirm('編集中の内容が破棄されます。続けますか？')) {
      return;
    }
    setSelectedTemplateId(tpl.id);
    setNewGoal(tpl.body);
  };

  const topicError = newTopic && !TOPIC_REGEX.test(newTopic)
    ? 'topic は a-z, 0-9, - のみ、両端は英数、2-100 文字'
    : null;
  const goalLenOk = newGoal.length >= 10 && newGoal.length <= 50000;

  const handleCreate = async () => {
    setFormError(null);
    if (!newTopic.trim()) { setFormError('topic を入力してください'); return; }
    if (topicError) { setFormError(topicError); return; }
    if (!goalLenOk) { setFormError(`goal_content は 10-50000 文字 (現在 ${newGoal.length})`); return; }
    // いずれかのテンプレ body と完全一致 = 雛形のまま
    if (researchTemplates.some(t => t.body === newGoal)) {
      setFormError('goal_content が雛形のままです。調査内容を記述してください');
      return;
    }
    // 未置換の placeholder がある場合は警告 (キャンセル可能)
    if (unresolvedPlaceholders.length > 0) {
      const ok = confirm(
        `未置換の placeholder が残っています (${unresolvedPlaceholders.join(', ')})。このまま送信しますか？`,
      );
      if (!ok) return;
    }

    setCreating(true);
    try {
      await createResearchRequest({
        topic: newTopic.trim(),
        engine: 'claude',
        goal_content: newGoal,
        channel: 'admin',
      });
      resetForm();
      setFormOpen(false);
      setOffset(0);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listResearchRequests({
        status: statusFilter || undefined,
        limit,
        offset,
        order: 'desc',
      });
      setRequests(res.data);
      setTotal(res.meta.total);
    } catch (e) {
      console.error(e);
      alert(`Failed to load: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const handleRetry = async (req: ResearchRequest) => {
    if (req.status !== 'failed') return;
    if (!confirm(`"${req.topic}" を再キューに戻しますか？\n\n前回のエラー情報・開始時刻はクリアされ、次の poller tick で再実行されます。`)) return;

    setRetryingId(req.id);
    try {
      await retryResearchRequest(req.id);
      await load();
    } catch (e) {
      alert(`Retry failed: ${(e as Error).message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (req: ResearchRequest) => {
    if (req.status === 'running') {
      alert('running 状態のリクエストは削除できません。poller の完了を待ってください。');
      return;
    }
    if (!confirm(`"${req.topic}" を削除しますか？この操作は元に戻せません。`)) return;

    setDeletingId(req.id);
    try {
      await deleteResearchRequest(req.id);
      // 最終ページの最後の要素を削除した場合、offset が範囲外になるので前ページへ
      if (requests.length === 1 && offset > 0) {
        setOffset(Math.max(0, offset - limit));
      } else {
        await load();
      }
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const stats = [
    { label: 'Total', value: total, color: 'var(--admin-text)' },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>🔬 Research Requests</h1>

      <StatsGrid stats={stats} />

      <div style={{
        border: '1px solid var(--admin-border)',
        borderRadius: 'var(--admin-radius-md)',
        marginBottom: '1rem',
        background: 'var(--admin-surface)',
        overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => { setFormOpen(!formOpen); if (formOpen) resetForm(); }}
          aria-expanded={formOpen}
          data-testid="research-form-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '0.75rem 1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--admin-text)',
            fontSize: '0.9rem',
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          <span>➕ New Research Request</span>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--admin-text-muted)',
            fontWeight: 400,
          }}>
            {formOpen ? '▲ Close' : '▼ Open'}
          </span>
        </button>

        {formOpen && (
          <div style={{
            padding: '0 1rem 1rem',
            borderTop: '1px solid var(--admin-border)',
            paddingTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--admin-text-muted)' }}>
                Template
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {researchTemplates.map(tpl => {
                  const active = tpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => selectTemplate(tpl)}
                      disabled={creating}
                      style={{
                        padding: '0.3rem 0.7rem',
                        border: '1px solid ' + (active ? 'var(--admin-primary)' : 'var(--admin-border)'),
                        background: active ? 'var(--admin-primary)' : 'transparent',
                        color: active ? '#fff' : 'var(--admin-text)',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        cursor: creating ? 'not-allowed' : 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      <span style={{ marginRight: '0.3rem' }}>{tpl.emoji}</span>
                      {tpl.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: '0.375rem', fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                {selectedTemplate.description}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--admin-text-muted)' }}>
                Topic <span style={{ color: 'var(--admin-danger)' }}>*</span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                  (a-z, 0-9, -, 2-100 chars, e.g. "rust-web-frameworks")
                </span>
              </label>
              <input
                type="text"
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                placeholder="my-research-topic"
                className="form-input"
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  borderColor: topicError ? 'var(--admin-danger)' : undefined,
                }}
              />
              {topicError && (
                <div style={{ fontSize: '0.7rem', color: 'var(--admin-danger)', marginTop: '0.25rem' }}>
                  {topicError}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', color: 'var(--admin-text-muted)' }}>
                Goal content <span style={{ color: 'var(--admin-danger)' }}>*</span>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                  (Markdown, 10-50000 chars, current: {newGoal.length})
                </span>
              </label>
              <textarea
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                rows={12}
                className="form-input"
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                  borderColor: !goalLenOk ? 'var(--admin-danger)' : undefined,
                }}
              />
              {unresolvedPlaceholders.length > 0 && (
                <div style={{
                  marginTop: '0.3rem',
                  fontSize: '0.72rem',
                  color: 'var(--admin-warning, #d97706)',
                }}>
                  ⚠️ 未置換 placeholder: {unresolvedPlaceholders.join(', ')}
                </div>
              )}
            </div>

            {formError && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--admin-radius-sm)',
                background: 'var(--admin-surface)',
                border: '1px solid var(--admin-danger)',
                color: 'var(--admin-danger)',
                fontSize: '0.8rem',
              }}>
                {formError}
              </div>
            )}

            <div className="flex gap-sm" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={resetForm}
                disabled={creating}
              >
                Reset
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreate}
                disabled={creating || !newTopic.trim() || !!topicError || !goalLenOk}
              >
                {creating ? 'Creating…' : 'Create request'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-sm mb-md flex-wrap items-center">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as StatusFilter); setOffset(0); }}
          className="form-select"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
          {total} requests {statusFilter && `(filtered: ${statusFilter})`}
        </span>
      </div>

      {loading && requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
          No research requests
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {requests.map(req => (
            <div
              key={req.id}
              style={{
                border: '1px solid var(--admin-border)',
                borderRadius: 'var(--admin-radius-md)',
                padding: '0.75rem 1rem',
                background: 'var(--admin-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className={statusBadgeClass(req.status)} style={statusBadgeStyle(req.status)}>
                  {req.status}
                </span>
                <strong style={{ flex: '1 1 200px', wordBreak: 'break-all' }}>{req.topic}</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                  {formatChannel(req)} · {req.engine}
                </span>
              </div>

              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>created: {formatTimestamp(req.created_at)}</span>
                {req.started_at && <span>started: {formatTimestamp(req.started_at)}</span>}
                {req.completed_at && <span>completed: {formatTimestamp(req.completed_at)}</span>}
              </div>

              {req.status === 'completed' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <Link
                    to={`/report/${encodeURIComponent(`deep-research/${req.topic}`)}`}
                    style={{ color: 'var(--admin-primary)' }}
                  >
                    📄 admin で開く
                  </Link>
                  {req.report_url && (req.report_url.startsWith('http')) && (
                    <a
                      href={req.report_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}
                    >
                      🌐 公開サイト ↗
                    </a>
                  )}
                </div>
              )}

              {req.error_message && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{
                    fontSize: '0.8rem',
                    color: 'var(--admin-danger)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}>
                    Error: {req.error_message.split('\n')[0].slice(0, 120)}
                    {req.error_message.length > 120 || req.error_message.includes('\n') ? ' …' : ''}
                  </summary>
                  <pre style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 'var(--admin-radius-sm)',
                    fontSize: '0.72rem',
                    color: 'var(--admin-text)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflow: 'auto',
                  }}>{req.error_message}</pre>
                </details>
              )}

              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                >
                  {expandedId === req.id ? 'Hide' : 'Show'} goal
                </button>
                {req.status === 'failed' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRetry(req)}
                    disabled={retryingId === req.id}
                    title="再キューに戻して poller に再実行させる"
                  >
                    {retryingId === req.id ? 'Retrying…' : '↻ Retry'}
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(req)}
                  disabled={req.status === 'running' || deletingId === req.id}
                  title={req.status === 'running' ? 'running is not deletable' : 'Delete this request'}
                >
                  {deletingId === req.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>

              {expandedId === req.id && (
                <pre style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem',
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius-sm)',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}>{req.goal_content}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="flex gap-sm mt-md items-center" style={{ justifyContent: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
          >
            ← Prev
          </button>
          <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
            {offset + 1}–{Math.min(offset + limit, total)} / {total}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
