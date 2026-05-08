/**
 * Dashboard banner for reports committed to D1 but not yet live in the
 * static build. Checks canonical URL availability via HEAD request and
 * picks preview or canonical link accordingly.
 *
 * Design: docs/plans/2026-04-23-daily-preview-d1-design.md (private)
 */
import { useEffect, useState } from 'react';
import { getFeatureLabel, getFeatureRegion, REGION_META } from '../features';

interface LatestReport {
  id: string;
  feature: string;
  date: string;
  title: string | null;
  summary: string | null;
  language: string | null;
  static_url: string;
  preview_url: string;
}

interface DisplayReport extends LatestReport {
  live: boolean;
  label: string;
}

export function LatestReportsBanner() {
  const [items, setItems] = useState<DisplayReport[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/latest-reports', {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const { reports } = (await res.json()) as { reports: LatestReport[] };
        if (!reports?.length) return;

        // Probe each canonical URL in parallel with a short timeout so a slow
        // CDN doesn't block banner rendering.
        const probes = await Promise.all(
          reports.map(async (r) => {
            try {
              const head = await fetch(r.static_url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000),
              });
              return head.ok;
            } catch {
              return false;
            }
          })
        );

        if (cancelled) return;

        const display: DisplayReport[] = reports.map((r, i) => ({
          ...r,
          live: probes[i],
          label: `${getFeatureLabel(r.feature)} ${REGION_META[getFeatureRegion(r.feature)].flag} — ${r.date}`,
        }));

        setItems(display);
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Render a hidden marker so the parent slot can detect "no banner" via
  // :has(.latest-banner-none) and collapse its reserved min-height.
  if (dismissed) return <span class="latest-banner-none" />;
  if (!items || items.length === 0) return null;

  const pending = items.filter((it) => !it.live);

  // Hide the banner entirely once everything is live.
  if (pending.length === 0) return <span class="latest-banner-none" />;

  return (
    <div class="latest-banner" role="status">
      <div class="latest-banner-header">
        <span class="latest-banner-icon" aria-hidden="true">🆕</span>
        <span class="latest-banner-title">
          本日の新着 {items.length} 件
          {pending.length > 0 && (
            <span class="latest-banner-note">
              （{pending.length} 件は反映待ち、preview で先読み可能）
            </span>
          )}
        </span>
        <button
          type="button"
          class="latest-banner-close"
          onClick={() => setDismissed(true)}
          aria-label="バナーを閉じる"
        >
          ×
        </button>
      </div>
      <ul class="latest-banner-list">
        {items.map((it) => (
          <li key={it.id} class={it.live ? 'latest-banner-item live' : 'latest-banner-item preview'}>
            <a href={it.live ? it.static_url : it.preview_url}>
              <span class="latest-banner-label">{it.label}</span>
              {!it.live && <span class="latest-banner-badge">preview</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
