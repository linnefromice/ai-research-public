import { useState, useEffect } from 'react';
import { getTrends, type TagCount } from '../api/client';

export function Trends() {
  const [tags, setTags] = useState<TagCount[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const res = await getTrends(days); setTags(res.data); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [days]);

  // tag_type='other' は汎用タグとしてトレンド対象外 (ランキングに乗せる意味が薄いため除外)
  const visibleTags = tags.filter(t => t.tag_type !== 'other');
  const maxCount = Math.max(...visibleTags.map(t => t.report_count), 1);

  return (
    <div>
      <div className="flex justify-between items-center mb-lg flex-wrap gap-md">
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Trending Tags</h1>
        <div className="flex gap-sm">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-ghost'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : visibleTags.length === 0 ? (
        <p className="text-dim">No trending tags in this period.</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {visibleTags.map((t, i) => (
            <div key={t.tag} className="card flex items-center gap-md" style={{ padding: '0.6rem 0.75rem' }}>
              <span className="text-xs text-dim" style={{ width: '24px', textAlign: 'right' }}>#{i + 1}</span>
              <span className={`tag ${t.tag_type === 'theme' ? 'tag-theme' : 'tag-keyword'}`}>{t.tag_type}</span>
              <span className="flex-1 font-semibold" style={{ fontSize: '0.9rem' }}>{t.tag}</span>
              <div className="progress-bar hide-mobile" style={{ width: '120px' }}>
                <div className="progress-fill" style={{ width: `${(t.report_count / maxCount) * 100}%` }} />
              </div>
              <span className="text-xs text-muted" style={{ width: '70px', textAlign: 'right' }}>{t.report_count} reports</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
