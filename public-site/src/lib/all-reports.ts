/**
 * Merge live + archive Astro Content Collections into a single list.
 *
 * The repo splits reports into two collections per feature:
 *   - `<feature>` — recent reports under `features/<feature>/reports/` (last
 *     ~7 days, kept fresh in the static build)
 *   - `<feature>-archive` — older reports under `features/<feature>/archive/`
 *     (excluded from the SSR Worker bundle to keep size in check)
 *
 * Listing pages and the `[feature]/[...slug].astro` getStaticPaths consume
 * both collections through this helper so users see the full history. SSR
 * endpoints (`.md.ts`, `feed`, `latest/`) deliberately bypass this helper and
 * read from D1 — that is what keeps the archive collection out of the Worker
 * bundle.
 *
 * Returns the merged list with no sort order applied; callers sort by
 * date (or whatever they need) themselves.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

type AnyCollectionKey = Parameters<typeof getCollection>[0];

export async function getAllReports<T extends string>(
  featureSlug: T
): Promise<CollectionEntry<AnyCollectionKey>[]> {
  const live = await getCollection(featureSlug as AnyCollectionKey);
  if (featureSlug === 'deep-research') return live;

  let archive: CollectionEntry<AnyCollectionKey>[] = [];
  try {
    archive = await getCollection(`${featureSlug}-archive` as AnyCollectionKey);
  } catch {
    // Empty / missing archive directory — ignore.
  }
  return [...live, ...archive];
}
