import { useState, useEffect, useCallback, Fragment } from 'react';
import type { CSSProperties } from 'react';
import {
  listEvents,
  resolveEvent,
  type PipelineEvent,
  type EventSeverity,
} from '../api/client';

type ResolvedFilter = 'unresolved' | 'resolved' | 'all';

const SEVERITY_OPTIONS: ('' | EventSeverity)[] = ['', 'error', 'warning', 'info'];

function severityBadgeStyle(severity: EventSeverity): CSSProperties {
  switch (severity) {
    case 'error': return { background: 'var(--admin-danger)', color: '#fff' };
    case 'warning': return { background: 'var(--admin-warning)', color: '#fff' };
    case 'info': return { background: 'var(--admin-primary)', color: '#fff' };
  }
}

// 行の左 border 色で severity を強調 (resolved は灰色で上書き)
function severityBorderColor(severity: EventSeverity, resolved: boolean): string {
  if (resolved) return 'var(--admin-border)';
  switch (severity) {
    case 'error': return 'var(--admin-danger)';
    case 'warning': return 'var(--admin-warning)';
    case 'info': return 'var(--admin-primary)';
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
  } catch { return iso; }
}

const LIMIT = 30;

export default function Events() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<'' | EventSeverity>('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof listEvents>[0] = { limit: LIMIT, offset };
      if (resolvedFilter !== 'all') params.resolved = resolvedFilter === 'resolved';
      if (severityFilter) params.severity = severityFilter;
      const res = await listEvents(params);
      setEvents(res.data);
      setTotal(res.meta.total);
    } catch (e) {
      console.error('Failed to fetch events:', e);
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter, severityFilter, offset]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleResolve = async (id: string) => {
    try {
      await resolveEvent(id);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, resolved: 1 } : e));
    } catch (e) {
      console.error('Failed to resolve event:', e);
    }
  };

  const changeResolvedFilter = (next: ResolvedFilter) => {
    setResolvedFilter(next);
    setOffset(0);
    setExpandedId(null);
  };
  const changeSeverityFilter = (next: '' | EventSeverity) => {
    setSeverityFilter(next);
    setOffset(0);
    setExpandedId(null);
  };

  const pageTo = (nextOffset: number) => {
    setOffset(nextOffset);
    setExpandedId(null);
  };

  const unresolvedCount = events.filter(e => !e.resolved).length;
  const colSpan = 5;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>
          Pipeline Events
          {unresolvedCount > 0 && (
            <span className="badge badge-danger" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
              {unresolvedCount} unresolved
            </span>
          )}
        </h2>
        <button className="btn btn-sm btn-ghost" onClick={fetchEvents} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select
          className="form-select"
          value={resolvedFilter}
          onChange={e => changeResolvedFilter(e.target.value as ResolvedFilter)}
          style={{ width: 'auto' }}
        >
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select
          className="form-select"
          value={severityFilter}
          onChange={e => changeSeverityFilter(e.target.value as '' | EventSeverity)}
          style={{ width: 'auto' }}
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span style={{ color: 'var(--admin-text-muted)', alignSelf: 'center', fontSize: '0.85rem', marginLeft: 'auto' }}>
          {total} total
        </span>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '90px' }}>Severity</th>
              <th style={{ width: '140px' }}>Feature</th>
              <th style={{ width: '170px' }}>Type</th>
              <th>Title</th>
              <th style={{ width: '140px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && !loading && (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', color: 'var(--admin-text-muted)', padding: '2rem' }}>
                  No events
                </td>
              </tr>
            )}
            {events.map(evt => {
              const isResolved = !!evt.resolved;
              const isExpanded = expandedId === evt.id;
              const borderColor = severityBorderColor(evt.severity, isResolved);
              return (
                <Fragment key={evt.id}>
                  <tr
                    className={`table-row-clickable ${isExpanded ? 'table-row-expanded' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                    style={{
                      opacity: isResolved ? 0.65 : 1,
                      borderLeft: `4px solid ${borderColor}`,
                    }}
                  >
                    <td>
                      <span className="badge" style={{ ...severityBadgeStyle(evt.severity), fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                        {evt.severity}
                      </span>
                      {isResolved && (
                        <span style={{ marginLeft: '0.4rem', color: 'var(--admin-text-muted)', fontSize: '0.7rem' }}>
                          ✓
                        </span>
                      )}
                    </td>
                    <td style={{ color: evt.feature ? 'var(--admin-text)' : 'var(--admin-text-dim)' }}>
                      {evt.feature ?? '—'}
                    </td>
                    <td>
                      <span className="table-chip">{evt.event_type}</span>
                    </td>
                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {evt.title}
                    </td>
                    <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>
                      {formatTimestamp(evt.created_at)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={colSpan} style={{ padding: 0, borderLeft: `4px solid ${borderColor}` }}>
                        <div className="table-expanded-panel">
                          <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-dim)', marginBottom: '0.4rem' }}>
                            <span>ID: </span>
                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{evt.id}</span>
                          </div>
                          {evt.details ? (
                            <pre>{evt.details}</pre>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', padding: '0.4rem 0' }}>
                              No additional details
                            </div>
                          )}
                          {!isResolved && (
                            <div style={{ marginTop: '0.6rem' }}>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={e => { e.stopPropagation(); handleResolve(evt.id); }}
                              >
                                Resolve
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > LIMIT && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', justifyContent: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => pageTo(Math.max(0, offset - LIMIT))}
            disabled={offset === 0 || loading}
          >
            ← Prev
          </button>
          <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} / {total}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => pageTo(offset + LIMIT)}
            disabled={offset + LIMIT >= total || loading}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
