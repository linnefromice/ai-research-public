import { useState } from 'react';
import { updateReport } from '../api/client';

export function PublishToggle({ reportId, initialPublished, onToggle }: { reportId: string; initialPublished: boolean; onToggle?: () => void }) {
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !published;
    const msg = next
      ? `"${reportId}" を公開しますか？公開サイトで閲覧可能になります。`
      : `"${reportId}" を非公開に戻しますか？`;
    if (!confirm(msg)) return;

    setLoading(true);
    try {
      await updateReport(reportId, { published: next });
      setPublished(next);
      onToggle?.();
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        padding: '0.25rem 0.6rem',
        borderRadius: '12px',
        border: 'none',
        fontSize: '0.7rem',
        fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        background: published ? '#4ade80' : '#ef4444',
        color: '#fff',
        opacity: loading ? 0.6 : 1,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {published ? 'Published' : 'Unpublished'}
    </button>
  );
}
