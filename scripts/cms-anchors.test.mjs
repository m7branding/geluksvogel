import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { addAnchors, collectBindings, anchorMarkup, ANCHOR } from './cms-anchors.mjs';

const componentDir = new URL('../src/components/', import.meta.url);
const dataDir = new URL('../src/data/', import.meta.url);

const component = (markup) => `---
import page from "../data/about.json";
const {
  eyebrow = page.hero.eyebrow,
  headline = page.hero.headline,
  image = page.hero.image,
} = Astro.props;
---
${markup}`;

test('a field is anchored on the element that renders it', () => {
  const { source, skipped } = addAnchors(component('<p class="eyebrow">{eyebrow}</p>'));
  assert.match(source, /<p data-cms="about\.hero\.eyebrow" class="eyebrow">/);
  assert.deepEqual(skipped, []);
});

test('the innermost element wins, so nested fields stay separate', () => {
  const { source } = addAnchors(component('<h1>{headline} <mark>{eyebrow}</mark></h1>'));
  assert.match(source, /<h1 data-cms="about\.hero\.headline">/);
  assert.match(source, /<mark data-cms="about\.hero\.eyebrow">/);
});

test('an image is anchored through its source attribute', () => {
  const { source } = addAnchors(component('<img src={image} alt="">'));
  assert.match(source, /<img data-cms="about\.hero\.image" src=\{image\} alt="">/);
});

test('running twice changes nothing', () => {
  const once = addAnchors(component('<p>{eyebrow}</p>')).source;
  assert.equal(addAnchors(once).source, once);
});

test('text outside the data files is left alone', () => {
  const { source, anchored } = addAnchors(component('<p>Vaste tekst {unknown}</p>'));
  assert.doesNotMatch(source, new RegExp(ANCHOR));
  assert.deepEqual(anchored, []);
});

test('comments and self-closing tags do not confuse the scan', () => {
  const bindings = collectBindings(component(''));
  const { anchored } = anchorMarkup('<div><!-- <span> --><br><p>{eyebrow}</p></div>', bindings);
  assert.deepEqual(anchored.map((a) => a.path), ['about.hero.eyebrow']);
});

test('every component carries up-to-date anchors', async () => {
  const files = (await readdir(componentDir)).filter((f) => f.endsWith('.astro'));
  const stale = [];
  for (const file of files) {
    const source = await readFile(new URL(file, componentDir), 'utf8');
    if (addAnchors(source).source !== source) stale.push(file);
  }
  assert.deepEqual(stale, [], 'run "npm run cms:anchors" after changing a component');
});

test('every anchor points at a field that exists', async () => {
  const files = (await readdir(componentDir)).filter((f) => f.endsWith('.astro'));
  const data = new Map();
  let checked = 0;
  for (const file of files) {
    const source = await readFile(new URL(file, componentDir), 'utf8');
    for (const [, value] of source.matchAll(new RegExp(`${ANCHOR}="([^"]+)"`, 'g'))) {
      const [entry, ...path] = value.split('.');
      if (!data.has(entry)) data.set(entry, JSON.parse(await readFile(new URL(`${entry}.json`, dataDir), 'utf8')));
      const found = path.reduce((node, key) => (node == null ? node : node[key]), data.get(entry));
      assert.equal(typeof found, 'string', `${file}: ${value} does not exist in ${entry}.json`);
      checked++;
    }
  }
  assert.ok(checked > 250, `expected the whole site to be anchored, got ${checked}`);
});
