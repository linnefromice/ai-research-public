import { useState, useEffect } from 'react';
import { authClient } from '../lib/auth-client';

interface Note {
  report_id: string;
  title: string;
  feature: string;
  date: string;
  content: string;
  updated_at: string;
}

interface FeatureInfo {
  slug: string;
  label: string;
  color: string;
}

interface Props {
  features: FeatureInfo[];
}

/**
 * ログインユーザーの個人メモ一覧。
 * /api/engage/notes/list から認証必須で取得する。
 * 未ログイン時は「ログインしてください」を表示。
 */
export function MyNotesList({ features }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      setNotes([]);
      return;
    }

    fetch('/api/engage/notes/list')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNotes(data.data ?? []);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load notes');
        setNotes([]);
      });
  }, [session, isPending]);

  const featureMap = new Map(features.map((f) => [f.slug, f]));

  if (isPending || notes === null) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>;
  }

  if (!session?.user) {
    return (
      <div style={{ padding: '2rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</p>
        <p style={{ color: 'var(--color-text)', marginBottom: '0.25rem' }}>ログインが必要です</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          サイドバーの Login ボタンからログインしてください。
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', border: '1px solid var(--color-danger)', borderRadius: '8px' }}>
        <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div style={{ padding: '2rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</p>
        <p style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>まだメモがありません</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          レポート詳細ページの <strong>📝 My Note</strong> セクションから書き込めます。
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
        {notes.length} note{notes.length !== 1 ? 's' : ''}
      </p>
      {notes.map((note) => {
        const feature = featureMap.get(note.feature);
        const reportPath = `/${note.report_id}/`;
        const updated = new Date(note.updated_at).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div
            key={note.report_id}
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: feature?.color ?? 'var(--color-text-muted)',
                  flexShrink: 0,
                }}
              />
              <a
                href={reportPath}
                style={{
                  flex: 1,
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {note.title}
              </a>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                {feature?.label ?? note.feature} · {note.date}
              </span>
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--color-text)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: '0.25rem 0 0.4rem 0',
              }}
            >
              {note.content}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Updated: {updated}
            </p>
          </div>
        );
      })}
    </div>
  );
}
