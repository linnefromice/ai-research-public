import { Link } from 'react-router-dom';
import type { Report } from '../api/client';
import { PublishToggle } from './PublishToggle';
import { timeAgo } from '../lib/format';

interface Props {
  report: Report;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}

export function ReportListItem({ report: r, selected, onSelect, onToggle }: Props) {
  return (
    <div
      className="report-row flex items-center gap-md card"
      style={{
        padding: '0.6rem 0.75rem',
        borderColor: selected ? 'var(--admin-primary)' : undefined,
        background: selected ? 'var(--admin-surface-hover)' : undefined,
      }}
    >
      {/* checkbox + PublishToggle を group 化。desktop は display: contents で flow に溶ける、
          mobile は 1 行の flex row になって縦スペースを節約する */}
      <div className="report-row-header">
        <input type="checkbox" checked={selected} onChange={onSelect} style={{ cursor: 'pointer', flexShrink: 0 }} />
        <PublishToggle reportId={r.id} initialPublished={r.published === 1} onToggle={onToggle} />
      </div>
      <Link to={`/report/${encodeURIComponent(r.id)}`} className="flex-1 min-w-0" style={{ textDecoration: 'none', color: 'var(--admin-text)' }}>
        <div className="font-semibold truncate report-title" style={{ fontSize: '0.85rem' }}>{r.title}</div>
        <div className="text-xs text-muted truncate">
          {r.feature} · {r.date} · {r.engine} · {r.article_count} articles
          {r.session !== 'daily' ? ` · ${r.session}` : ''}
        </div>
      </Link>
      <span className="text-xxs text-dim shrink-0">{timeAgo(r.updated_at)}</span>
    </div>
  );
}
