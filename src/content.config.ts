import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// Each recipe and story keeps the address it had on the old WordPress site:
// the file name is the URL, so /avocado-toast/ comes from avocado-toast.md.
const recepten = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recepten' }),
  schema: z.object({
    title: z.string(),
    order: z.number().int().positive(),
    date: z.coerce.date(),
    description: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    ingredients: z.array(z.string()).min(1),
  }),
});

const verhalen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/verhalen' }),
  schema: z.object({
    title: z.string(),
    order: z.number().int().positive(),
    date: z.coerce.date(),
    category: z.string(),
    description: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    gallery: z.array(z.object({ image: z.string(), alt: z.string() })).default([]),
  }),
});

export const collections = { recepten, verhalen };
