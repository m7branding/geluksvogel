// Prepare only the build output; local Decap remains available in public/admin.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { productionCmsConfig, siteHtaccess, siteUrl } from './cms-production.mjs';

export { siteUrl };

/** Every public page of the build, so search engines find the site after the move. */
export async function sitemap(root) {
  const pages = (await readdir(root, { recursive: true }))
    .filter((f) => f.endsWith('index.html') && !f.startsWith('admin'))
    .map((f) => `/${f.replace(/index\.html$/, '')}`)
    .sort();
  const urls = pages.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function prepareStaging(dir, commit, { siteId = '', forceHttps = false, target = 'production' } = {}) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('A full Git commit is required.');
  const root = resolve(dir);
  await readFile(resolve(root, 'index.html'));
  const cmsEnabled = Boolean(siteId.trim());
  if (cmsEnabled) {
    const config = productionCmsConfig(await readFile(resolve(root, 'admin/config.yml'), 'utf8'), siteId);
    await readFile(resolve(root, 'admin/index.html'));
    await readFile(resolve(root, 'admin/preview.js'));
    await writeFile(resolve(root, 'admin/config.yml'), stringify(config));
  } else {
    await rm(resolve(root, 'admin'), { recursive: true, force: true });
    await mkdir(resolve(root, 'admin'));
    await writeFile(resolve(root, 'admin/index.html'), `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Beheer | GeluksVogel</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f6f5ef;color:#183e29}main{max-width:38rem;margin:15vh auto;padding:2rem}a{color:inherit}</style>
</head><body><main><h1>Beheer is nog niet beschikbaar</h1><p>Deze omgeving wordt ingericht.</p><a href="/">Terug naar de website</a></main></body></html>\n`);
  }
  const crawlable = target !== 'staging';
  if (crawlable) {
    await writeFile(resolve(root, 'sitemap.xml'), await sitemap(root));
    await writeFile(resolve(root, 'robots.txt'), `User-agent: *\nDisallow:\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  } else {
    await rm(resolve(root, 'sitemap.xml'), { force: true });
    await writeFile(resolve(root, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  }
  await writeFile(resolve(root, '.htaccess'), siteHtaccess({ target, forceHttps }));
  await writeFile(resolve(root, 'deployment.json'), JSON.stringify({
    target, siteUrl, commit, builtAt: new Date().toISOString(),
    cmsEnabled, cmsSiteId: cmsEnabled ? siteId.trim() : null,
  }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const siteId = process.env.DECAPBRIDGE_SITE_ID || '';
  const target = process.env.DEPLOY_TARGET === 'staging' ? 'staging' : 'production';
  await prepareStaging('dist', commit, { siteId, target, forceHttps: process.env.VIMEXX_FORCE_HTTPS_REDIRECT === 'true' });
  console.log(`${target} build prepared for ${siteUrl}; CMS ${siteId.trim() ? 'configured with DecapBridge' : 'pending configuration'}.`);
}
