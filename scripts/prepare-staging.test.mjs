import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareStaging } from './prepare-staging.mjs';
import { parse } from 'yaml';
import { validateStagingBuild } from './validate-staging.mjs';

const testSiteId = '11111111-2222-4333-8444-555555555555';

test('staging cannot expose the local CMS and records the exact published commit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-staging-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'index.html'), '<h1>GeluksVogel</h1>');
  await writeFile(join(root, 'admin/config.yml'), 'local_backend: true\n');
  await writeFile(join(root, 'admin/index.html'), '<script src="decap-cms.js"></script>');
  const commit = 'a'.repeat(40);
  await prepareStaging(root, commit);
  assert.equal(await readFile(join(root, 'index.html'), 'utf8'), '<h1>GeluksVogel</h1>');
  await assert.rejects(access(join(root, 'admin/config.yml')));
  assert.doesNotMatch(await readFile(join(root, 'admin/index.html'), 'utf8'), /decap-cms|localhost/);
  const manifest = JSON.parse(await readFile(join(root, 'deployment.json'), 'utf8'));
  assert.equal(manifest.commit, commit);
  assert.equal(manifest.cmsEnabled, false);
  assert.equal(manifest.siteUrl, 'https://geluksvogel.bio');
  assert.equal(manifest.target, 'production');
  // A live site must be findable and cacheable.
  const htaccess = await readFile(join(root, '.htaccess'), 'utf8');
  assert.doesNotMatch(htaccess, /noindex|no-store/);
  assert.match(htaccess, /X-Content-Type-Options "nosniff"/);
  assert.equal(await readFile(join(root, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow:\n\nSitemap: https://geluksvogel.bio/sitemap.xml\n');
  const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/geluksvogel\.bio\/<\/loc>/);
  assert.doesNotMatch(sitemap, /admin/);
  // Old WordPress addresses move on; a relative target would send visitors to
  // http first, so the address is named in full. The hack's spam pages are gone.
  assert.match(htaccess, /RewriteRule \^category\/recepten\/\?\$ https:\/\/geluksvogel\.bio\/recepten\/ \[R=301,L\]/);
  assert.match(htaccess, /RewriteRule \^lucky-hour-review-for-australian-players-12\/\?\$ - \[G,L\]/);
  assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
  // The domain redirects wait until the hosting has been checked.
  assert.doesNotMatch(htaccess, /HTTP_HOST/);
});

test('a staging build stays out of search results and out of caches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-staging-target-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'index.html'), '<h1>GeluksVogel</h1>');
  await prepareStaging(root, 'e'.repeat(40), { target: 'staging' });
  const htaccess = await readFile(join(root, '.htaccess'), 'utf8');
  assert.match(htaccess, /X-Robots-Tag "noindex, nofollow"/);
  assert.match(htaccess, /Cache-Control "no-store"/);
  assert.equal(await readFile(join(root, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  await assert.rejects(access(join(root, 'sitemap.xml')), 'a staging build has no sitemap');
  const manifest = JSON.parse(await readFile(join(root, 'deployment.json'), 'utf8'));
  assert.equal(manifest.target, 'staging');
  assert.equal(validateStagingBuild(root, 'e'.repeat(40), 'staging').target, 'staging');
});

test('an invalid commit or missing build is rejected before replacing the admin files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-staging-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'admin/config.yml'), 'local_backend: true\n');
  await assert.rejects(prepareStaging(root, 'unknown'), /full Git commit/);
  await assert.rejects(prepareStaging(root, 'b'.repeat(40)), /ENOENT/);
  assert.equal(await readFile(join(root, 'admin/config.yml'), 'utf8'), 'local_backend: true\n');
});

test('an online CMS build preserves all GeluksVogel fields and the local source while using its own identity', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-online-cms-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceUrl = new URL('../public/admin/config.yml', import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'index.html'), '<h1>GeluksVogel</h1>');
  await writeFile(join(root, 'admin/config.yml'), source);
  await writeFile(join(root, 'admin/index.html'), '<script src="decap-cms.js"></script>');
  await writeFile(join(root, 'admin/preview.js'), '// preview');
  const commit = 'c'.repeat(40);
  await prepareStaging(root, commit, { siteId: testSiteId });
  const config = parse(await readFile(join(root, 'admin/config.yml'), 'utf8'));
  assert.deepEqual(config.collections, parse(source).collections);
  assert.equal(config.backend.repo, 'm7branding/geluksvogel');
  assert.equal(config.backend.identity_url, `https://auth.decapbridge.com/sites/${testSiteId}`);
  assert.equal(config.local_backend, false);
  assert.equal(await readFile(sourceUrl, 'utf8'), source);
  assert.match(await readFile(join(root, 'admin/index.html'), 'utf8'), /decap-cms/);
  assert.equal(validateStagingBuild(root, commit).cmsEnabled, true);
});

test('a malformed DecapBridge identity fails before changing the copied CMS', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-cms-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'admin'));
  await writeFile(join(root, 'index.html'), 'GeluksVogel');
  await writeFile(join(root, 'admin/config.yml'), 'local_backend: true\ncollections: []\n');
  await assert.rejects(prepareStaging(root, 'd'.repeat(40), { siteId: 'not-a-site-id' }), /UUID/);
  assert.equal(await readFile(join(root, 'admin/config.yml'), 'utf8'), 'local_backend: true\ncollections: []\n');
});
