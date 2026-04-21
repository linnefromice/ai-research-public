/**
 * Deep Research レポート内の [^1] 脚注リンクに hover で原文抜粋 tooltip を表示
 *
 * 使い方: BaseLayout の script で `initFootnotePreview()` を呼ぶ
 */

export function initFootnotePreview(): void {
  if (typeof document === 'undefined') return;

  // 脚注参照 <a href="#fn-1"> を検出
  const fnRefs = document.querySelectorAll<HTMLAnchorElement>('a[href^="#fn-"], sup a[href^="#"]');

  fnRefs.forEach(ref => {
    const href = ref.getAttribute('href');
    if (!href) return;
    const targetId = href.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    // 原文は target 要素のテキスト (最初の 200 文字)
    const excerpt = (target.textContent || '').slice(0, 200).trim();
    if (!excerpt) return;

    let tooltip: HTMLDivElement | null = null;

    ref.addEventListener('mouseenter', (e) => {
      if (tooltip) return;
      tooltip = document.createElement('div');
      tooltip.className = 'footnote-tooltip';
      tooltip.textContent = excerpt + (excerpt.length >= 200 ? '...' : '');
      tooltip.style.cssText = [
        'position:absolute', 'z-index:9999',
        'background:var(--color-surface)', 'border:1px solid var(--color-border)',
        'border-radius:6px', 'padding:0.5rem 0.75rem',
        'max-width:400px', 'font-size:0.8rem', 'color:var(--color-text)',
        'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
        'line-height:1.5',
      ].join(';');
      document.body.appendChild(tooltip);
      const rect = ref.getBoundingClientRect();
      tooltip.style.left = `${rect.left + window.scrollX}px`;
      tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
    });

    ref.addEventListener('mouseleave', () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    });
  });
}

// auto-init if loaded as plain script
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFootnotePreview);
  } else {
    initFootnotePreview();
  }
}
