import { useState, useEffect } from 'react';
import { authClient } from '../lib/auth-client';

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
};

export function NoteEditor({ reportId }: { reportId: string }) {
  const { data: session } = authClient.useSession();
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      try {
        const res = await fetch(`/api/engage/note?report_id=${encodeURIComponent(reportId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.content) {
            setContent(data.data.content);
            setOpen(true);
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, [session, reportId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/engage/note', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, content }),
      });
      setSaved(true);
    } catch (e) {
      console.warn('Save note failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('メモを削除しますか？')) return;
    try {
      await fetch(`/api/engage/note?report_id=${encodeURIComponent(reportId)}`, { method: 'DELETE' });
      setContent('');
      setSaved(true);
      setOpen(false);
    } catch (e) {
      console.warn('Delete note failed:', e);
    }
  };

  if (!session?.user) {
    return (
      <div style={{ ...panelStyle, padding: '0.75rem 1rem', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>📝 Notes — ログインして個人メモを保存</span>
      </div>
    );
  }

  if (!loaded) return null;

  return (
    <div style={{ marginTop: '1rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...panelStyle,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.75rem',
          color: 'var(--color-text)',
          fontSize: '0.8rem',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left' as const,
        }}
      >
        <span>📝</span>
        <span style={{ flex: 1 }}>My Note</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0 0 8px 8px' }}>
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setSaved(false); }}
            rows={4}
            placeholder="このレポートに関するメモ..."
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
              lineHeight: 1.6,
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.4rem' }}>
            {content && (
              <button onClick={handleDelete} style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--color-danger)', borderRadius: '4px', color: 'var(--color-danger)', fontSize: '0.7rem', cursor: 'pointer' }}>
                Delete
              </button>
            )}
            {!saved && (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)', alignSelf: 'center', marginRight: '0.25rem' }}>Unsaved</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                padding: '0.3rem 0.75rem',
                background: saved ? 'var(--color-border)' : 'var(--color-primary)',
                color: saved ? 'var(--color-text-muted)' : 'var(--color-bg)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: saving || saved ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
