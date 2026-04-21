import { authClient } from '../lib/auth-client';

const btnStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '4px',
  color: 'var(--color-text)',
  fontSize: '0.6rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  width: '100%',
  textAlign: 'center',
};

export function LoginButton() {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending) {
    return <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>...</span>;
  }

  // 認証サービス未設定時はボタンを非表示
  if (error) {
    return null;
  }

  if (session?.user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.user.name || session.user.email}
        </span>
        <button
          onClick={() => authClient.signOut().catch(e => console.warn('Sign out failed:', e))}
          style={{ ...btnStyle, background: 'transparent' }}
        >
          Logout
        </button>
      </div>
    );
  }

  const handleSignIn = (provider: 'github' | 'google') => {
    authClient.signIn.social({ provider }).catch(e => {
      console.warn(`Sign in with ${provider} failed:`, e);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%' }}>
      <button onClick={() => handleSignIn('github')} style={btnStyle}>
        Login GitHub
      </button>
    </div>
  );
}
