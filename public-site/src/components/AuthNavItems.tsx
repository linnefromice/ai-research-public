import { authClient } from '../lib/auth-client';

interface Props {
  activeFeature?: string;
}

/**
 * ログイン時のみ表示されるナビゲーション項目。
 * Navigation.astro の sidebar 内に React Island として配置する。
 * 未ログイン・認証サービス未設定時は何も表示しない（UI をスッキリ保つ）。
 */
export function AuthNavItems({ activeFeature }: Props) {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending || error || !session?.user) {
    return null;
  }

  const items = [
    { href: '/my/bookmarks/', icon: '⭐', label: 'Favs', active: activeFeature === '_my_bookmarks' },
    { href: '/my/notes/', icon: '📝', label: 'Notes', active: activeFeature === '_my_notes' },
  ];

  return (
    <>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={`sidebar-item${item.active ? ' active' : ''}`}
        >
          <span className="sidebar-icon">{item.icon}</span>
          <span className="sidebar-label">{item.label}</span>
        </a>
      ))}
    </>
  );
}

/**
 * モバイル下部バー用の同等コンポーネント。
 * モバイルは項目数が限られているので、お気に入りのみを表示する。
 */
export function AuthMobileTabs({ activeFeature }: { activeFeature?: string }) {
  const { data: session, isPending, error } = authClient.useSession();

  if (isPending || error || !session?.user) {
    return null;
  }

  const isActive = activeFeature === '_my_bookmarks' || activeFeature === '_my_notes';

  return (
    <a href="/my/bookmarks/" className={`mobile-tab${isActive ? ' active' : ''}`}>
      <span className="mobile-icon">⭐</span>
      <span className="mobile-label">Mine</span>
    </a>
  );
}
