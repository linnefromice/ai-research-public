import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const reportSchema = z.object({
  title: z.string(),
  date: z.string(),
  feature: z.string(),
  engine: z.string(),
  session: z.string().optional().default('daily'),
  topic: z.string().optional(),
  original_date: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  refresh_count: z.number().optional().default(0),
});

function reportCollection(baseDir: string) {
  return defineCollection({
    loader: glob({ pattern: '**/*.md', base: baseDir }),
    schema: reportSchema,
  });
}

// Live (recent) collections — always bundled into static SSG pages.
// File source: features/<slug>/reports/ via deploy-side symlink.
const FEATURE_SLUGS = [
  'tech-trends',
  'tech-trends-global',
  'finance-markets',
  'invest-japan',
  'invest-global',
  'productivity',
  'wellness',
  'wellness-global',
  'parenting-baby',
  'parenting-edu',
  'parenting-global',
  'family-finance',
  'family-finance-global',
  'workstyle',
  'workstyle-global',
  'deep-research',
] as const;

// Archive collections — separate so SSR endpoints can reference *only* the
// live collections (smaller Worker bundle). Listing/SSG pages merge both via
// the `getAllReports()` helper in src/lib/all-reports.ts.
// File source: features/<slug>/archive/ via deploy-side symlink.
// deep-research has no archive (kept all reports in reports/).
const ARCHIVE_FEATURE_SLUGS = FEATURE_SLUGS.filter((s) => s !== 'deep-research');

const liveEntries = FEATURE_SLUGS.map(
  (slug) => [slug, reportCollection(`./src/content/${slug}`)] as const
);
const archiveEntries = ARCHIVE_FEATURE_SLUGS.map(
  (slug) => [`${slug}-archive`, reportCollection(`./src/content/${slug}-archive`)] as const
);

export const collections = Object.fromEntries([...liveEntries, ...archiveEntries]);
