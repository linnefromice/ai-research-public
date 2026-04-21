export type FeatureRegion = 'jp' | 'global';

export interface Feature {
  slug: string;
  /** English label used for card titles and the left nav. */
  label: string;
  color: string;
  collection: string;
  /** 'global' for EN+JA features (slug ends with `-global`). 'jp' for
   * Japan-local single-language features. */
  region: FeatureRegion;
}

export interface FeatureGroup {
  slug: string;
  label: string;
  features: Feature[];
}

// Feature labels intentionally drop the "Global" suffix: the region is shown
// via a separate badge (REGION_META) so labels don't duplicate the info.
export const features: Feature[] = [
  { slug: 'tech-trends', label: 'Tech Trends', color: 'var(--color-accent-tech)', collection: 'tech-trends', region: 'jp' },
  { slug: 'tech-trends-global', label: 'Tech Trends', color: 'var(--color-accent-tech-gl)', collection: 'tech-trends-global', region: 'global' },
  { slug: 'finance-markets', label: 'Finance Markets', color: 'var(--color-accent-finance)', collection: 'finance-markets', region: 'jp' },
  { slug: 'invest-japan', label: 'Invest', color: 'var(--color-accent-invest-jp)', collection: 'invest-japan', region: 'jp' },
  { slug: 'invest-global', label: 'Invest', color: 'var(--color-accent-invest-gl)', collection: 'invest-global', region: 'global' },
  { slug: 'productivity', label: 'Productivity', color: 'var(--color-accent-productivity)', collection: 'productivity', region: 'jp' },
  { slug: 'wellness', label: 'Wellness', color: 'var(--color-accent-wellness)', collection: 'wellness', region: 'jp' },
  { slug: 'wellness-global', label: 'Wellness', color: 'var(--color-accent-wellness-gl)', collection: 'wellness-global', region: 'global' },
  { slug: 'parenting-baby', label: 'Parenting · Baby', color: 'var(--color-accent-parenting-baby)', collection: 'parenting-baby', region: 'jp' },
  { slug: 'parenting-edu', label: 'Parenting · Edu', color: 'var(--color-accent-parenting-edu)', collection: 'parenting-edu', region: 'jp' },
  { slug: 'parenting-global', label: 'Parenting', color: 'var(--color-accent-parenting-gl)', collection: 'parenting-global', region: 'global' },
  { slug: 'family-finance', label: 'Family Finance', color: 'var(--color-accent-family-finance)', collection: 'family-finance', region: 'jp' },
  { slug: 'family-finance-global', label: 'Family Finance', color: 'var(--color-accent-family-finance-gl)', collection: 'family-finance-global', region: 'global' },
  { slug: 'workstyle', label: 'Workstyle', color: 'var(--color-accent-workstyle)', collection: 'workstyle', region: 'jp' },
  { slug: 'workstyle-global', label: 'Workstyle', color: 'var(--color-accent-workstyle-gl)', collection: 'workstyle-global', region: 'global' },
  { slug: 'deep-research', label: 'Deep Research', color: 'var(--color-accent-deep-research)', collection: 'deep-research', region: 'jp' },
];

export const REGION_META: Record<FeatureRegion, { label: string; short: string; flag: string }> = {
  jp: { label: 'Japan', short: 'JP', flag: '🇯🇵' },
  global: { label: 'Global', short: 'Global', flag: '🌐' },
};

// Daily report features (excludes deep-research)
export const dailyFeatures = features.filter(f => f.slug !== 'deep-research');

// Research feature
export const researchFeature = features.find(f => f.slug === 'deep-research')!;

export const featureGroups: FeatureGroup[] = [
  {
    slug: 'tech',
    label: 'Tech',
    features: features.filter(f => ['tech-trends', 'tech-trends-global'].includes(f.slug)),
  },
  {
    slug: 'markets',
    label: 'Markets',
    features: features.filter(f => ['finance-markets', 'invest-japan', 'invest-global', 'family-finance', 'family-finance-global'].includes(f.slug)),
  },
  {
    slug: 'life',
    label: 'Life',
    features: features.filter(f => ['productivity', 'wellness', 'wellness-global', 'workstyle', 'workstyle-global'].includes(f.slug)),
  },
  {
    slug: 'parenting',
    label: 'Parenting',
    features: features.filter(f => ['parenting-baby', 'parenting-edu', 'parenting-global'].includes(f.slug)),
  },
];

export const featureBySlug = Object.fromEntries(features.map(f => [f.slug, f]));

export function getFeatureLabel(slug: string): string {
  return featureBySlug[slug]?.label ?? slug;
}

export function getFeatureColor(slug: string): string {
  return featureBySlug[slug]?.color ?? 'var(--color-primary)';
}

export function getFeatureRegion(slug: string): FeatureRegion {
  return featureBySlug[slug]?.region ?? 'jp';
}

// Precomputed slug → group slug map derived from `featureGroups`.
const groupBySlug: Record<string, string> = Object.fromEntries(
  featureGroups.flatMap(g => g.features.map(f => [f.slug, g.slug]))
);

/**
 * Return the group slug this feature belongs to (e.g. 'tech', 'markets', 'life',
 * 'parenting'). Returns 'other' if the feature is not classified (currently
 * only deep-research, which is filtered out of dailyFeatures anyway).
 */
export function getFeatureGroup(slug: string): string {
  return groupBySlug[slug] ?? 'other';
}

/**
 * Build the card title in well-formed English. The frontmatter's raw title
 * is slug-based ("tech-trends Report - 2026-04-12") so we derive a cleaner
 * one from the feature label at render time.
 */
export function buildReportCardTitle(slug: string, date: string): string {
  return `${getFeatureLabel(slug)} Report — ${date}`;
}
