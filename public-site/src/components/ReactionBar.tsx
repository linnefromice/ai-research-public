import { useState, useEffect } from 'react';
import { authClient } from '../lib/auth-client';

interface Stats {
  views: number;
  likes: number;
  dislikes: number;
  user_reaction: 'like' | 'dislike' | null;
}

export function ReactionBar({ reportId }: { reportId: string }) {
  const { data: session } = authClient.useSession();
  const [stats, setStats] = useState<Stats>({ views: 0, likes: 0, dislikes: 0, user_reaction: null });
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/engage/stats?report_id=${encodeURIComponent(reportId)}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (e) {
      console.warn('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    const uid = localStorage.getItem('openclaw_uid') || (() => {
      const id = crypto.randomUUID();
      localStorage.setItem('openclaw_uid', id);
      return id;
    })();

    fetch('/api/engage/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, fingerprint: uid }),
    }).catch(() => {});

    fetchStats();
  }, [reportId]);

  const handleReact = async (reaction: 'like' | 'dislike') => {
    if (!session?.user) {
      alert('ログインして評価してください');
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/engage/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, reaction }),
      });
      await fetchStats();
    } catch (e) {
      console.warn('Reaction failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const btnBase: React.CSSProperties = {
    padding: '0.35rem 0.7rem',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: loading ? 'wait' : 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  };

  const isLiked = stats.user_reaction === 'like';
  const isDisliked = stats.user_reaction === 'dislike';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', padding: '0.75rem 0', borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={() => handleReact('like')}
        disabled={loading}
        style={{
          ...btnBase,
          background: isLiked ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-bg)',
          borderColor: isLiked ? 'var(--color-primary)' : 'var(--color-border)',
          color: isLiked ? 'var(--color-primary)' : 'var(--color-text)',
        }}
      >
        👍 {stats.likes}
      </button>
      <button
        onClick={() => handleReact('dislike')}
        disabled={loading}
        style={{
          ...btnBase,
          background: isDisliked ? 'color-mix(in srgb, var(--color-danger) 20%, transparent)' : 'var(--color-bg)',
          borderColor: isDisliked ? 'var(--color-danger)' : 'var(--color-border)',
          color: isDisliked ? 'var(--color-danger)' : 'var(--color-text)',
        }}
      >
        👎 {stats.dislikes}
      </button>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
        👁 {stats.views} views
      </span>
    </div>
  );
}
