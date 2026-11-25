import { getCollection, type CollectionEntry } from 'astro:content';

export type Product = CollectionEntry<'products'>;

export const categories = {
  templates: { label: 'Affinity templates', title: 'Start from a strong layout', nav: 'Templates' },
  brushes: { label: 'Brushes & textures', title: 'Grit, grain and ink', nav: 'Brushes & textures' },
  social: { label: 'Social media packs', title: 'Post-ready in minutes', nav: 'Social packs' },
} as const;

export type CategoryKey = keyof typeof categories;

export const collectionsInfo = {
  offset: {
    name: 'Offset',
    text: 'Print grit for screens: halftones, grain, misregistration and riso-style overlays.',
  },
  detach: {
    name: 'Detach',
    text: 'The starter kit for leaving Adobe: templates, swatches and shortcuts to get you working in Affinity on day one.',
  },
} as const;

export type CollectionKey = keyof typeof collectionsInfo;

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
