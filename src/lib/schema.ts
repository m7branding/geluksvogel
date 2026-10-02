import type { CollectionEntry } from 'astro:content';

/** schema.org data, so search engines can show a recipe or story as one. */
export function entrySchema(entry: CollectionEntry<'recepten'> | CollectionEntry<'verhalen'>, site: URL) {
  const url = new URL(`/${entry.id}/`, site).href;
  const image = new URL(entry.data.image, site).href;
  const publisher = { '@type': 'Organization', name: 'GeluksVogel', url: new URL('/', site).href };
  if (entry.collection === 'recepten') {
    const steps = (entry.body ?? '').split('\n').map((line) => /^\d+\.\s+(.*)$/.exec(line.trim())?.[1]).filter(Boolean);
    return {
      '@context': 'https://schema.org', '@type': 'Recipe', name: entry.data.title, url, image: [image],
      description: entry.data.description, datePublished: entry.data.date.toISOString().slice(0, 10),
      author: publisher, recipeIngredient: entry.data.ingredients,
      recipeInstructions: steps.map((text) => ({ '@type': 'HowToStep', text })),
    };
  }
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: entry.data.title, url, image: [image],
    description: entry.data.description, datePublished: entry.data.date.toISOString().slice(0, 10),
    author: publisher, publisher,
  };
}
