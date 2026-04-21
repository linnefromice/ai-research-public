import { useState, useEffect } from 'react';

export interface ReportMeta {
  id: string;         // feature/slug
  title: string;
  feature: string;
  featureLabel: string;
  featureColor: string;
  slug: string;
  date: string;
  session?: string;
}

interface Props {
  allReports: ReportMeta[];
}

const BOOKMARKS_KEY = 'openclaw_bookmarks';

/**
 * ログインユーザー向けブックマーク一覧。
 * ブックマーク自体は localStorage ベースのため認証は不要だが、
 * このページ自体はログイン時のみナビゲーションから到達できる設計。
 * 未ログインで直接 URL アクセスした場合は「ログインして使ってください」を表示。
 */
export function MyBookmarksList({ allReports }: Props) {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      setBookmarkedIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setBookmarkedIds(new Set());
    }
  }, []);

  if (bookmarkedIds === null) {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>;
  }

  const filtered = allReports.filter((r) => bookmarkedIds.has(r.id));

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '2rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⭐</p>
        <p style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>まだお気に入りがありません</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          レポート詳細ページの <strong>🔖 Bookmark</strong> ボタンから追加できます。
        </p>
      </div>
    );
  }

  const removeBookmark = (id: string) => {
    const next = new Set(bookmarkedIds);
    next.delete(id);
    setBookmarkedIds(next);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
  };

  const exportAsMarkdown = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const lines = [
      '# My Bookmarks',
      '',
      `Exported: ${new Date().toISOString().slice(0, 10)}`,
      '',
      ...filtered.map(r => `- [${r.title}](${origin}/${r.feature}/${r.slug}/) — ${r.featureLabel} / ${r.date}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsOpml = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const items = filtered.map(r =>
      `    <outline type="link" text="${escape(r.title)}" url="${origin}/${r.feature}/${r.slug}/" />`
    ).join('\n');
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>OpenClaw Bookmarks</title></head>
  <body>
${items}
  </body>
</opml>`;
    const blob = new Blob([opml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.opml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
          {filtered.length} bookmarked
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={exportAsMarkdown} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text)' }}>
            📄 Export MD
          </button>
          <button onClick={exportAsOpml} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text)' }}>
            📋 Export OPML
          </button>
        </div>
      </div>
      {filtered.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: r.featureColor,
              flexShrink: 0,
            }}
          />
          <a
            href={`/${r.feature}/${r.slug}/`}
            style={{
              flex: 1,
              color: 'var(--color-text)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.title}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
              {r.featureLabel} · {r.date}
              {r.session && r.session !== 'daily' ? ` · ${r.session}` : ''}
            </span>
          </a>
          <button
            onClick={() => removeBookmark(r.id)}
            title="Remove bookmark"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              color: 'var(--color-text-muted)',
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
