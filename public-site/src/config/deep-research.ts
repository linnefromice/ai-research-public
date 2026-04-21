// Deep Research の鮮度警告しきい値 (日数)。
// この日数を超えて `updated_at` が更新されていないレポートは、
// 詳細ページで警告バナーが表示される。
export const STALENESS_WARN_DAYS = 30;

/**
 * updated_at (ISO8601) からの経過日数を返す。未指定の場合は date にフォールバック。
 * 入力が不正なら null。
 */
export function ageInDays(updatedAt: string | undefined, fallbackDate?: string): number | null {
  const raw = updatedAt ?? fallbackDate;
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isStale(updatedAt: string | undefined, fallbackDate?: string): boolean {
  const age = ageInDays(updatedAt, fallbackDate);
  return age !== null && age > STALENESS_WARN_DAYS;
}
