/**
 * Helpers for deduplicating multilingual reports on listing pages.
 *
 * Multilingual features (languages = [en, ja] in feature.yaml) produce two
 * files per report date: `<date>.en.md` and `<date>.ja.md`. `getCollection()`
 * returns both as independent entries, which surfaces as two cards for the
 * same report on the dashboard. Single-language features output `<date>.md`
 * with no suffix, and session reports produce `<date>-<session>.md`.
 *
 * We collapse language variants to one card per (feature, date, session) and
 * prefer the JA variant since the public site audience is Japanese.
 */

export type ReportLang = 'ja' | 'en' | null;

/**
 * Derive the language suffix from a content collection id.
 *
 * Astro's glob loader strips dots from filenames when generating ids: e.g.
 * `2026-04-12.ja.md` becomes `2026-04-12ja`. So we can't rely on `.ja` / `.en`
 * separators — match the bare suffix at the end of the id instead, but only
 * after a trailing date or session block to avoid false positives like
 * `green` (ends with `en`).
 */
export function detectLang(id: string): ReportLang {
  // Matches either `.ja` / `.en` (unlikely after Astro's transform) or
  // `ja` / `en` appended directly to a YYYY-MM-DD[-session] stem.
  if (/\.ja$|^\d{4}-\d{2}-\d{2}(?:-[a-z]+)?ja$/.test(id)) return 'ja';
  if (/\.en$|^\d{4}-\d{2}-\d{2}(?:-[a-z]+)?en$/.test(id)) return 'en';
  return null;
}

/** Higher = preferred when dedup picks a winner. */
function langPriority(lang: ReportLang): number {
  if (lang === 'ja') return 3;
  if (lang === 'en') return 2;
  return 1; // non-multilingual single file
}

export interface ReportLike {
  id: string;
  feature: string;
  data: { date: string; session?: string };
}

/**
 * Deduplicate a flat list of reports, keeping at most one entry per
 * (feature, date, session). Prefers JA > EN > untagged.
 */
export function dedupByLang<T extends ReportLike>(reports: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of reports) {
    const key = `${r.feature}|${r.data.date}|${r.data.session ?? 'daily'}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, r);
      continue;
    }
    if (langPriority(detectLang(r.id)) > langPriority(detectLang(current.id))) {
      best.set(key, r);
    }
  }
  return [...best.values()];
}
