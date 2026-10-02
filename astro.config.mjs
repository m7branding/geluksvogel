import { defineConfig } from 'astro/config';
import { siteUrl } from './scripts/site-url.mjs';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  build: { format: 'directory' },
});
