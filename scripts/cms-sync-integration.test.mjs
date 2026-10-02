import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { syncOnce } from './cms-sync.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'geluksvogel sync with spaces '));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['components', 'pages', 'data']) await mkdir(path.join(root, 'src', folder), { recursive: true });
  const put = (file, text) => writeFile(path.join(root, file), text);
  const get = (file) => readFile(path.join(root, file), 'utf8');
  const component = (file) => `---\nimport homepage from '../data/${file}.json';\nconst { headline = homepage.hero.headline } = Astro.props;\n---\n<h1>{headline}</h1>\n`;
  await put('src/components/HomeHero.astro', component('homepage'));
  await put('src/components/AboutHero.astro', component('about'));
  await put('src/data/homepage.json', JSON.stringify({ hero: { headline: 'Home' } }));
  await put('src/data/about.json', JSON.stringify({ hero: { headline: 'About' } }));
  await put('src/pages/index.astro', '<BaseLayout><HomeHero headline="New home" /></BaseLayout>');
  await put('src/pages/about.astro', '<BaseLayout><AboutHero headline="New about" /></BaseLayout>');
  return { root, put, get, component };
}

test('simultaneous edits with the same field names go to their own page files', async (t) => {
  const { root, get } = await fixture(t);
  const changes = await syncOnce(root);
  assert.equal(changes.length, 2);
  assert.equal(JSON.parse(await get('src/data/homepage.json')).hero.headline, 'New home');
  assert.equal(JSON.parse(await get('src/data/about.json')).hero.headline, 'New about');
  assert.equal(await get('src/pages/index.astro'), '<BaseLayout><HomeHero /></BaseLayout>');
  assert.equal(await get('src/pages/about.astro'), '<BaseLayout><AboutHero /></BaseLayout>');
  assert.equal((await syncOnce(root)).length, 0, 'a second sync is a no-op');
});

test('check mode detects changes without writing any files', async (t) => {
  const { root, get } = await fixture(t);
  assert.equal((await syncOnce(root, { write: false })).length, 2);
  assert.match(await get('src/pages/about.astro'), /headline="New about"/);
  assert.equal(JSON.parse(await get('src/data/about.json')).hero.headline, 'About');
});

test('canvas edits use the component import to find the right JSON file', async (t) => {
  const { root, get, put, component } = await fixture(t);
  await put('src/pages/about.astro', '<BaseLayout><AboutHero /></BaseLayout>');
  await put('src/components/AboutHero.astro', component('about').replace('<h1>{headline}</h1>', '<h1>Canvas &amp; CMS</h1>'));
  const result = await syncOnce(root, { baselines: { AboutHero: component('about') } });
  assert.equal(result.unresolved.length, 0);
  assert.equal(JSON.parse(await get('src/data/about.json')).hero.headline, 'Canvas & CMS');
  assert.equal(await get('src/components/AboutHero.astro'), component('about'));
});

test('conflicting instances never silently overwrite shared content', async (t) => {
  const { root, get, put } = await fixture(t);
  await put('src/pages/other.astro', '<BaseLayout><HomeHero headline="Different home" /></BaseLayout>');
  await assert.rejects(syncOnce(root), /Conflicting Stacki edits/);
  assert.equal(JSON.parse(await get('src/data/homepage.json')).hero.headline, 'Home');
  assert.match(await get('src/pages/index.astro'), /headline="New home"/);
});
