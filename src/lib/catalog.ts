import { getCollection, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>;

export * from './structure';
import { categories, sections, typesIn, type CategoryKey, type SectionKey } from './structure';

export async function getProducts(filter?: (p: Product) => boolean) {
  const all = await getCollection('products');
  return all
    .filter((p) => (filter ? filter(p) : true))
    .sort(
      (a, b) =>
        Number(a.data.comingSoon) - Number(b.data.comingSoon) ||
        a.data.order - b.data.order ||
        a.data.title.localeCompare(b.data.title),
    );
}

/** "Free", "€9", "From €9" or "Soon"; a missing price shows as a dash so it is easy to spot. */
export function priceLabel(p: Product) {
  if (p.data.comingSoon) return 'Soon';
  if (p.data.free) return 'Free';
  const prices = p.data.licenses
    .map((l) => l.price)
    .filter((n): n is number => typeof n === 'number');
  if (!prices.length) return '€ –';
  const min = Math.min(...prices);
  return prices.length > 1 && new Set(prices).size > 1 ? `From ${euro(min)}` : euro(min);
}

export function euro(n: number | null | undefined) {
  if (n === null || n === undefined) return '€ –';
  if (n === 0) return 'Free';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

export const sectionOf = (p: Product) => categories[p.data.category].section as SectionKey;

/** How many products each type has; the menu marks empty types as "Soon". */
export async function typeCounts() {
  const counts = {} as Record<CategoryKey, number>;
  for (const k of Object.keys(categories) as CategoryKey[]) counts[k] = 0;
  for (const p of await getProducts()) counts[p.data.category]++;
  return counts;
}

/** Tabs for a section page: "All graphics", then each type ("Soon" when it has no products yet). */
export async function sectionTabs(section: SectionKey) {
  const counts = await typeCounts();
  return [
    { key: 'all', label: sections[section].all, href: `/${section}/` },
    ...typesIn(section).map((k) => ({ key: k, label: categories[k].nav, href: `/${section}/${k}/`, soon: counts[k] === 0 })),
  ];
}
