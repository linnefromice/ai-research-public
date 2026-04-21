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

const techTrends = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tech-trends' }),
  schema: reportSchema,
});

const financeMarkets = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/finance-markets' }),
  schema: reportSchema,
});

const investJapan = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/invest-japan' }),
  schema: reportSchema,
});

const investGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/invest-global' }),
  schema: reportSchema,
});

const productivity = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/productivity' }),
  schema: reportSchema,
});

const wellness = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wellness' }),
  schema: reportSchema,
});

const parentingBaby = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/parenting-baby' }),
  schema: reportSchema,
});

const parentingEdu = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/parenting-edu' }),
  schema: reportSchema,
});

const familyFinance = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/family-finance' }),
  schema: reportSchema,
});

const workstyle = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/workstyle' }),
  schema: reportSchema,
});

const techTrendsGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tech-trends-global' }),
  schema: reportSchema,
});

const wellnessGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/wellness-global' }),
  schema: reportSchema,
});

const parentingGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/parenting-global' }),
  schema: reportSchema,
});

const familyFinanceGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/family-finance-global' }),
  schema: reportSchema,
});

const workstyleGlobal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/workstyle-global' }),
  schema: reportSchema,
});

const deepResearch = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/deep-research' }),
  schema: reportSchema,
});

export const collections = {
  'tech-trends': techTrends,
  'tech-trends-global': techTrendsGlobal,
  'finance-markets': financeMarkets,
  'invest-japan': investJapan,
  'invest-global': investGlobal,
  'productivity': productivity,
  'wellness': wellness,
  'wellness-global': wellnessGlobal,
  'parenting-baby': parentingBaby,
  'parenting-edu': parentingEdu,
  'parenting-global': parentingGlobal,
  'family-finance': familyFinance,
  'family-finance-global': familyFinanceGlobal,
  'workstyle': workstyle,
  'workstyle-global': workstyleGlobal,
  'deep-research': deepResearch,
};
