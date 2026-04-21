import { useState, useEffect, useCallback } from 'react';
import { listReports, updateReport, type Report } from '../api/client';
import { FEATURES } from '../lib/constants';
import { StatsGrid } from '../components/StatsGrid';
import { ReportListItem } from '../components/ReportListItem';

type SortKey = 'date' | 'feature' | 'articles';
type PublishFilter = '' | 'true' | 'false';

export function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [feature, setFeature] = useState('');
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReports({ feature: feature || undefined, published: publishFilter || undefined, limit, offset });
      setReports(res.data);
      setTotal(res.meta.total);
      setSelected(new Set());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [feature, publishFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const filtered = reports
    .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'feature') return a.feature.localeCompare(b.feature);
      if (sortKey === 'articles') return b.article_count - a.article_count;
      return b.date.localeCompare(a.date);
    });

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = [
    { label: 'Total', value: total, color: 'var(--admin-text)' },
    { label: 'Published', value: reports.filter(r => r.published === 1).length, color: 'var(--admin-success)' },
    { label: 'Unpublished', value: reports.filter(r => r.published === 0).length, color: 'var(--admin-danger)' },
    { label: 'Today', value: reports.filter(r => r.date === todayStr).length, color: 'var(--admin-primary)' },
  ];

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)));

  const bulkAction = async (publish: boolean) => {
    if (selected.size === 0 || !confirm(`${publish ? 'Publish' : 'Unpublish'} ${selected.size} reports?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => updateReport(id, { published: publish })));
      await load();
    } catch (e) { alert(`Error: ${(e as Error).message}`); }
    finally { setBulkLoading(false); }
  };

  return (
    <div>
      <StatsGrid stats={stats} />

      {/* Filters */}
      <div className="flex gap-sm mb-md flex-wrap items-center dashboard-filters">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or ID..." className="form-input" style={{ flex: '1 1 200px' }} />
        <select value={feature} onChange={e => { setFeature(e.target.value); setOffset(0); }} className="form-select">
          <option value="">All Features</option>
          {FEATURES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={publishFilter} onChange={e => { setPublishFilter(e.target.value as PublishFilter); setOffset(0); }} className="form-select">
          <option value="">All Status</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="form-select">
          <option value="date">Sort: Date</option>
          <option value="feature">Sort: Feature</option>
          <option value="articles">Sort: Articles</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex gap-sm mb-md items-center card" style={{ background: 'var(--admin-surface-hover)' }}>
          <span className="text-sm">{selected.size} selected</span>
          <button onClick={() => bulkAction(true)} disabled={bulkLoading} className="btn btn-sm btn-success">Publish All</button>
          <button onClick={() => bulkAction(false)} disabled={bulkLoading} className="btn btn-sm" style={{ background: 'var(--admin-danger)', color: '#fff' }}>Unpublish All</button>
          <button onClick={() => setSelected(new Set())} className="btn btn-sm btn-ghost">Clear</button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm" style={{ padding: '0.25rem 0.5rem' }}>
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ cursor: 'pointer' }} />
            <span className="text-xxs text-dim">Select all ({filtered.length})</span>
          </div>
          {filtered.map(r => (
            <ReportListItem key={r.id} report={r} selected={selected.has(r.id)} onSelect={() => toggleSelect(r.id)} onToggle={load} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center gap-md mb-lg flex-wrap" style={{ marginTop: '1.5rem' }}>
          <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="btn btn-ghost" style={{ color: offset === 0 ? 'var(--admin-text-dim)' : undefined }}>Prev</button>
          <span className="text-sm text-muted" style={{ alignSelf: 'center' }}>{offset + 1}-{Math.min(offset + limit, total)} / {total}</span>
          <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className="btn btn-ghost" style={{ color: offset + limit >= total ? 'var(--admin-text-dim)' : undefined }}>Next</button>
        </div>
      )}
    </div>
  );
}
