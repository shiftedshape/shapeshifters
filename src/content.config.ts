import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { categoryKeys, collectionKeys, toolKeys } from './lib/structure';

const swatch = z.enum(['lime', 'lilac', 'ink', 'white']).default('lilac');
const motif = z.enum(['dots', 'shapes', 'lines']).default('shapes');

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(categoryKeys),
    tools: z.array(z.enum(toolKeys)).default(['affinity']),
    collection: z.enum([...collectionKeys, 'none']).default('none'),
    summary: z.string(),
    excerpt: z.string(),
    free: z.boolean().default(false),
    color: swatch,
    motif: motif,
    cover: z.string().optional(),
    // A short muted loop (mp4/webm) that plays on cards instead of the cover image
    coverVideo: z.string().optional(),
    // Live demo: a page that runs the effect, e.g. https://fx.shiftedshape.com/embed/retro-screen/ or /demos/retro-screen/
    demoUrl: z.string().optional(),
    // Optional bigger page for the "Open live preview" button (e.g. a playground with settings); defaults to demoUrl
    previewUrl: z.string().optional(),
    // Show the live demo as the first gallery slide (otherwise only the "Live preview" button)
    demoEmbed: z.boolean().default(true),
    demoAspect: z.enum(['16/9', '3/2', '4/3', '1/1', '4/5']).default('16/9'),
    gallery: z
      .array(z.object({ image: z.string(), alt: z.string(), before: z.string().optional() }))
      .default([]),
    licenses: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          price: z.number().nullable().default(null),
          checkoutUrl: z.string().optional(),
        }),
      )
      .default([]),
    inside: z
      .array(z.object({ count: z.string(), label: z.string(), text: z.string() }))
      .default([]),
    specs: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    // A tutorial's file name, e.g. "riso-print-any-photo" (a path or ".md" from the CMS is fine too)
    tutorial: z
      .string()
      .optional()
      .transform((v) => (v ? v.split('/').pop()!.replace(/\.mdx?$/, '') : undefined)),
    featured: z.boolean().default(false),
    comingSoon: z.boolean().default(false),
    order: z.number().default(100),
  }),
});

const tools = defineCollection({
  loader: glob({ pattern: '**/*.{yml,yaml}', base: './src/content/tools' }),
  schema: z.object({
    name: z.string(),
    category: z.enum(['Design', 'Websites', 'Fonts', 'Resources', 'Business']),
    why: z.string(),
    url: z.string(),
    affiliate: z.boolean().default(false),
    monogram: z.string().max(3),
    order: z.number().default(100),
  }),
});

const tutorials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tutorials' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    kind: z.enum(['tutorial', 'cheatsheet', 'tip']).default('tutorial'),
    excerpt: z.string(),
    date: z.coerce.date(),
    video: z.string().optional(),
    color: swatch,
  }),
});

export const collections = { products, tools, tutorials };
