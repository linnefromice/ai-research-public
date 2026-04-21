import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getReport, deleteReport, getRelatedReports, type Report, type RelatedReport } from '../api/client';
import { PUBLIC_SITE_URL } from '../lib/constants';
import { PublishToggle } from '../components/PublishToggle';
import { SummaryEditor } from '../components/SummaryEditor';
import { TagEditor } from '../components/TagEditor';

export function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [related, setRelated] = useState<RelatedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const reportId = decodeURIComponent(id ?? '');

  const loadReport = async () => {
    setLoading(true);
    try {
      const [reportRes, relatedRes] = await Promise.all([
        getReport(reportId),
        getRelatedReports(reportId).catch(() => ({ data: [] as RelatedReport[] })),
      ]);
      setReport(reportRes.data);
      setRelated(relatedRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReport(); }, [reportId]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${reportId}"? This cannot be undone.`)) return;
    try { await deleteReport(reportId); navigate('/'); }
    catch (e) { alert(`Error: ${(e as Error).message}`); }
  };

  if (loading) return <p className="text-muted">Loading...</p>;
  if (!report) return <p style={{ color: 'var(--admin-danger)' }}>Report not found: {reportId}</p>;

  const reportUrl = `${PUBLIC_SITE_URL}/${reportId}`;

  return (
    <div>
      <Link to="/" className="text-sm text-muted">← Back to Dashboard</Link>

      <div className="mb-lg" style={{ marginTop: '1rem' }}>
        <div className="flex items-center gap-lg mb-sm flex-wrap">
          <h1 className="flex-1 min-w-0 report-detail-title" style={{ fontSize: '1.25rem', wordBreak: 'break-word' }}>{report.title}</h1>
          <PublishToggle reportId={report.id} initialPublished={report.published === 1} onToggle={loadReport} />
        </div>
        <div className="flex gap-md flex-wrap text-sm text-muted">
          <span>{report.feature} · {report.date} · {report.engine} · {report.article_count} articles · {report.session}</span>
        </div>
        <div className="flex gap-md flex-wrap text-xs text-dim" style={{ marginTop: '0.25rem' }}>
          <span>Updated: {new Date(report.updated_at).toLocaleString()}</span>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer">Open in site ↗</a>
        </div>
      </div>

      <section className="mb-xl">
        <div className="flex items-center justify-between mb-sm">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Preview</h2>
          <button onClick={() => setShowPreview(!showPreview)} className="btn btn-sm btn-ghost">{showPreview ? 'Hide' : 'Show'}</button>
        </div>
        {showPreview && (
          <div className="card" style={{ overflow: 'auto', maxHeight: '600px' }}>
            {report.published === 1 ? (
              /* Published: 公開サイトの SSG ページを iframe で表示 */
              <iframe
                src={reportUrl}
                title="Report preview"
                style={{ width: '100%', height: '600px', border: 'none' }}
              />
            ) : report.content ? (
              /* Unpublished + content あり: D1 の content を Markdown レンダリング */
              <div style={{ padding: '1.5rem', maxWidth: '800px', lineHeight: 1.8 }}>
                <ReactMarkdown>{report.content}</ReactMarkdown>
              </div>
            ) : (
              /* Unpublished + content なし: パイプライン未実行 */
              <p style={{ color: 'var(--admin-text-muted)', padding: '1.5rem' }}>
                Content not available. Run the pipeline to populate report content.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mb-xl">
        <h2 className="section-title">Summary</h2>
        <SummaryEditor reportId={report.id} initialSummary={report.summary} />
      </section>

      <section className="mb-xl">
        <h2 className="section-title">Tags</h2>
        <TagEditor reportId={report.id} />
      </section>

      {related.length > 0 && (
        <section className="mb-xl">
          <h2 className="section-title">Related Reports ({related.length})</h2>
          <div className="flex flex-col gap-sm">
            {related.map(r => (
              <Link key={r.report_id} to={`/report/${encodeURIComponent(r.report_id)}`} className="card card-hover flex items-center gap-md" style={{ textDecoration: 'none', color: 'var(--admin-text)', padding: '0.5rem 0.75rem' }}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ fontSize: '0.85rem' }}>{r.title}</div>
                  <div className="text-xs text-muted">{r.feature} · {r.date}</div>
                </div>
                <div className="flex gap-xs flex-wrap hide-mobile" style={{ maxWidth: '200px', justifyContent: 'flex-end' }}>
                  {r.shared_tags.slice(0, 3).map(tag => <span key={tag} className="tag tag-keyword">{tag}</span>)}
                  {r.shared_tags.length > 3 && <span className="text-xxs text-dim">+{r.shared_tags.length - 3}</span>}
                </div>
                <span className="text-xs text-dim shrink-0">{r.shared_count} shared</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}>
        <h2 className="section-title">Danger Zone</h2>
        <button onClick={handleDelete} className="btn btn-danger">Delete Report</button>
      </section>
    </div>
  );
}
