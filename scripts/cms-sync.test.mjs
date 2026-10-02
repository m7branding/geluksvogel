import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { mappingFrom, readComponents, cmsFileFrom, syncComponent, syncPage } from './cms-sync.mjs';

const components = {
  Model: `const {\n  class: className = "",\n  headline = homepage.model.headline,\n  sub = homepage.model.sub,\n  countUp = homepage.model.countUp,\n} = Astro.props;`,
  Footer: `const { tagline = homepage.footer.brandLine, email = homepage.footer.email } = Astro.props;`,
  About: `const { eyebrow = "About", headline = homepage.about.headline } = Astro.props;`,
};
const mapping = mappingFrom(components);
const data = {
  model: { headline: 'Old', sub: 'Old sub', countUp: true },
  footer: { brandLine: 'Old line', email: 'a@b.c' },
  about: { headline: 'About old' },
};

test('the mapping comes from the components, including renamed props and one-line destructuring', () => {
  assert.deepEqual(mapping.Model, { headline: ['model', 'headline'], sub: ['model', 'sub'], countUp: ['model', 'countUp'] });
  assert.deepEqual(mapping.Footer.tagline, ['footer', 'brandLine']);
  assert.equal(mapping.About.eyebrow, undefined);
});

test('text typed into a CMS prop moves into the data and leaves the page', () => {
  const page = `<BaseLayout>\n  <Model class="no-padding-bottom" headline="New &quot;house&quot;" />\n  <About eyebrow="" />\n</BaseLayout>\n`;
  const result = syncPage(page, data, mapping);
  assert.equal(result.data.model.headline, 'New "house"');
  assert.equal(result.page, `<BaseLayout>\n  <Model class="no-padding-bottom" />\n  <About eyebrow="" />\n</BaseLayout>\n`);
  assert.deepEqual(result.moved.map((m) => `${m.component}.${m.prop}`), ['Model.headline']);
  assert.equal(data.model.headline, 'Old', 'input data is not mutated');
});

test('a tag that only carried CMS props becomes self-closing again, across lines', () => {
  const page = `<Footer\n    tagline="Line"\n    email="x@y.z"\n  />`;
  const result = syncPage(page, data, mapping);
  assert.equal(result.page, '<Footer />');
  assert.equal(result.data.footer.brandLine, 'Line');
  assert.equal(result.data.footer.email, 'x@y.z');
});

test('values keep the type the CMS file already has, and expressions are left alone', () => {
  const result = syncPage(`<Model countUp="false" sub={homepage.model.sub} />`, data, mapping);
  assert.equal(result.data.model.countUp, false);
  assert.equal(result.page, `<Model sub={homepage.model.sub} />`);
});

test('all real component props map to existing fields in their own CMS file', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const components = await readComponents(root);
  let count = 0;
  for (const [component, source] of Object.entries(components)) {
    const file = cmsFileFrom(source);
    if (!file) continue;
    const data = JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
    for (const [prop, [section, key]] of Object.entries(mappingFrom({ [component]: source })[component] || {})) {
      assert.ok(section in data, `${component}.${prop} → ${file}:${section} exists`);
      assert.ok(key in data[section], `${component}.${prop} → ${section}.${key} exists`);
      count++;
    }
  }
  assert.ok(count > 350, `expected every section of the site to be mapped, got ${count}`);
});

const howBaseline = `---
const { headline = homepage.how.headline, highlight = homepage.how.highlight, sub = homepage.how.sub } = Astro.props;
---
<section>
  <h2>{headline} <em>{highlight}</em>.</h2>
  <p class="sub">{sub}</p>
</section>
`;
const howMapping = mappingFrom({ HowItWorks: howBaseline });
const howData = { how: { headline: 'Investment first', highlight: 'measured', sub: 'Old sub' } };

test('text typed over a binding on the canvas moves into the data and the binding returns', () => {
  const source = howBaseline.replace('<p class="sub">{sub}</p>', '<p class="sub">test &amp; test</p>');
  const result = syncComponent('HowItWorks', source, howBaseline, howData, howMapping);
  assert.equal(result.source, howBaseline);
  assert.equal(result.data.how.sub, 'test & test');
  assert.deepEqual(result.moved.map((m) => m.prop), ['sub']);
  assert.deepEqual(result.unresolved, []);
});

test('two bindings on one line are split into their own fields', () => {
  const source = howBaseline.replace('<h2>{headline} <em>{highlight}</em>.</h2>', '<h2>Nature first <em>always</em>.</h2>');
  const result = syncComponent('HowItWorks', source, howBaseline, howData, howMapping);
  assert.equal(result.data.how.headline, 'Nature first');
  assert.equal(result.data.how.highlight, 'always');
  assert.equal(result.source, howBaseline);
  assert.deepEqual(result.unresolved, []);
});

test('a retyped line that lost its structure is reported, never guessed or discarded', () => {
  const source = howBaseline.replace('<h2>{headline} <em>{highlight}</em>.</h2>', '<h2>Nature first always.</h2>');
  const result = syncComponent('HowItWorks', source, howBaseline, howData, howMapping);
  assert.equal(result.source, source);
  assert.deepEqual(result.data, howData);
  assert.deepEqual(result.unresolved, [{ component: 'HowItWorks', prop: 'headline' }, { component: 'HowItWorks', prop: 'highlight' }]);
});

test('layout edits elsewhere in a component are left alone', () => {
  const source = howBaseline.replace('<section>', '<section class="wide">').replace('<p class="sub">{sub}</p>', '<p class="sub">New</p>');
  const result = syncComponent('HowItWorks', source, howBaseline, howData, howMapping);
  assert.match(result.source, /<section class="wide">/);
  assert.match(result.source, /<p class="sub">\{sub\}<\/p>/);
  assert.equal(result.data.how.sub, 'New');
});

test('a component whose bindings are intact is untouched', () => {
  const result = syncComponent('HowItWorks', howBaseline.replace('<section>', '<section class="x">'), howBaseline, howData, howMapping);
  assert.deepEqual(result.moved, []);
  assert.equal(result.source, howBaseline.replace('<section>', '<section class="x">'));
});

test('an element that was deleted in the design is reported as removed, not as a text problem', () => {
  const baseline = howBaseline.replace('</section>', '  <img src={image} alt={imageAlt} />\n</section>')
    .replace('sub = homepage.how.sub }', 'sub = homepage.how.sub, image = homepage.how.image, imageAlt = homepage.how.imageAlt }');
  const mapping = mappingFrom({ HowItWorks: baseline });
  const emptied = syncComponent('HowItWorks', baseline.replace('<img src={image} alt={imageAlt} />', '<img />'), baseline, howData, mapping);
  assert.deepEqual(emptied.unresolved, []);
  assert.deepEqual(emptied.removed.map((r) => r.prop), ['image', 'imageAlt']);
  const gone = syncComponent('HowItWorks', baseline.replace('  <img src={image} alt={imageAlt} />\n', ''), baseline, howData, mapping);
  assert.deepEqual(gone.unresolved, []);
  assert.deepEqual(gone.removed.map((r) => r.prop), ['image', 'imageAlt']);
  const typed = syncComponent('HowItWorks', baseline.replace('<img src={image} alt={imageAlt} />', '<img src="/photo.jpg" alt="Photo" />'), baseline, howData, mapping);
  assert.deepEqual(typed.data.how, { ...howData.how, image: '/photo.jpg', imageAlt: 'Photo' });
  assert.deepEqual(typed.unresolved, []);
});
