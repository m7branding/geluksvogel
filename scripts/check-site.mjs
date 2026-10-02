// Validate the actual static output: every original WordPress address, every
// local link, image and fragment, and the address each page says it lives at.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { siteUrl } from './site-url.mjs';
import { originalRoutes, redirects } from './legacy-routes.mjs';

const root = path.resolve('dist');
const files = (await readdir(root, { recursive: true })).filter((f) => f.endsWith('.html'));
const nodes = (node) => [node, ...(node.childNodes || []).flatMap(nodes)];
const documents = new Map();
for (const file of files) documents.set(file, nodes(parse(await readFile(path.join(root, file), 'utf8'))));
const errors = [];
let checked = 0;
for (const [file, elements] of documents) {
  for (const node of elements) {
    for (const attr of node.attrs || []) {
      if (!['href', 'src', 'poster'].includes(attr.name) || !attr.value || attr.value === '#') continue;
      const url = new URL(attr.value, `https://local.test/${file}`);
      if (url.origin !== 'https://local.test') continue;
      let target = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      try {
        if ((await stat(path.join(root, target))).isDirectory()) target = path.join(target, 'index.html');
        await stat(path.join(root, target));
        if (url.hash && target.endsWith('.html')) {
          const id = decodeURIComponent(url.hash.slice(1));
          assert.ok(documents.get(target)?.some((n) => n.attrs?.some((a) => ['id', 'name'].includes(a.name) && a.value === id)), `missing #${id}`);
        }
        checked++;
      } catch (error) { errors.push(`${file}: ${attr.value} (${error.message})`); }
    }
  }
}
// Every page must say where it lives, or a move leaves a stale address behind.
const value = (elements, name, attribute, key) => elements
  .filter((n) => n.nodeName === name && n.attrs?.some((a) => a.name === attribute && a.value === key))
  .map((n) => n.attrs.find((a) => ['href', 'content'].includes(a.name))?.value);
let addresses = 0;
for (const [file, elements] of documents) {
  // The CMS app and the error page are not pages anyone should find in a search.
  if (file === 'admin/index.html' || file === '404.html') continue;
  const expected = `${siteUrl}/${file === 'index.html' ? '' : file.replace(/index\.html$/, '')}`;
  assert.deepEqual(value(elements, 'link', 'rel', 'canonical'), [expected], `${file}: canonical`);
  assert.deepEqual(value(elements, 'meta', 'property', 'og:url'), [expected], `${file}: og:url`);
  const [image] = value(elements, 'meta', 'property', 'og:image');
  assert.ok(image?.startsWith(`${siteUrl}/`), `${file}: og:image must be an absolute address, got ${image}`);
  addresses++;
}

for (const { path: route, source } of originalRoutes) {
  const page = `${route.slice(1)}index.html`;
  assert.ok(documents.has(page), `Missing original route ${route} (${source})`);
}
for (const [from, to] of redirects) {
  assert.ok(documents.has(`${to.slice(1)}index.html`), `Redirect ${from} leads to ${to}, which does not exist`);
}
assert.equal(errors.length, 0, errors.join('\n'));
console.log(`${originalRoutes.length} original WordPress routes, ${addresses} page addresses and ${checked} local links/assets/fragments checked.`);
