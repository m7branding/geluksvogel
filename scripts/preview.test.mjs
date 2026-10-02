import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

// The CMS preview is a browser script that Decap loads; run it against stubs for
// the globals Decap provides, so a broken preview pane is caught before publishing.
async function loadPreview() {
  const source = await readFile(new URL('../public/admin/preview.js', import.meta.url), 'utf8');
  const templates = new Map();
  const styles = [];
  const element = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
  const window = {
    h: element,
    CMS: {
      registerPreviewTemplate: (name, component) => templates.set(name, component),
      registerPreviewStyle: (css, options) => styles.push({ css, options }),
    },
  };
  const document = editorStub();
  const timers = [];
  new Function('window', 'document', 'setInterval', 'fetch', source)(
    window, document, (fn, ms) => timers.push({ fn, ms }), async () => ({ ok: false }),
  );
  return { templates, timers, styles, editor: document, api: window.GELUKSVOGEL_PREVIEW };
}

// A stand-in for the editor form: Decap nests the control of a field inside the
// control of the object it belongs to.
function editorStub() {
  const focused = [];
  const input = { focus: () => focused.push('input') };
  const leaf = {
    id: 'eyebrow-field-2', offsetParent: {}, style: {},
    matches: () => false, querySelector: () => input,
    scrollIntoView: () => focused.push('scroll'),
  };
  const section = {
    id: 'hero-field-1',
    querySelector: (selector) => (selector === '[id^="eyebrow-field-"]' ? leaf : null),
  };
  return {
    focused,
    querySelector: (selector) => (selector === '[id^="hero-field-"]' ? section : null),
  };
}

function pageStub() {
  const handlers = {};
  return {
    handlers,
    body: {}, head: { appendChild: () => {} },
    createElement: () => ({}),
    getElementById: () => null,
    addEventListener: (type, handler) => { handlers[type] = handler; },
  };
}

const entryFor = (slug, data) => ({
  get: (key) => (key === 'slug' ? slug : { toJS: () => data }),
});

function walk(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.type) found.push(node);
  for (const child of node.children || []) walk(child, found);
  return found;
}

test('the preview shows the page of the entry being edited', async () => {
  const { templates } = await loadPreview();
  const cases = [['onsverhaal', '/onsverhaal/'], ['homepage', '/'], ['site', '/'], ['contact', '/contact/'], ['niet-gevonden', '/404.html']];
  for (const [slug, expected] of cases) {
    const tree = templates.get(slug)({ entry: entryFor(slug, { meta: { title: 'GeluksVogel' } }) });
    const frames = walk(tree).filter((n) => n.type === 'iframe');
    assert.equal(frames.length, 1, `${slug}: expected exactly one preview frame`);
    assert.equal(frames[0].props.src, expected);
  }
});

test('a recipe or story shows its own page once it has been saved', async () => {
  const { templates } = await loadPreview();
  const folder = { get: (key) => (key === 'name' ? 'recept' : undefined) };
  const saved = templates.get('recept')({ entry: entryFor('avocado-toast', { title: 'Avocado toast' }), collection: folder });
  assert.equal(walk(saved).find((n) => n.type === 'iframe').props.src, '/avocado-toast/');
  const fresh = templates.get('verhaal')({
    entry: entryFor('', { title: 'Nieuw verhaal', gallery: [{ image: '/assets/uploads/kar.jpg', alt: 'De kar in de wei' }] }),
    collection: folder,
  });
  assert.equal(walk(fresh).filter((n) => n.type === 'iframe').length, 0, 'a new item has no page yet');
  const text = JSON.stringify(walk(fresh));
  assert.match(text, /Nieuw verhaal/);
  assert.match(text, /De kar in de wei/);
});

test('a file entry keeps its own page', async () => {
  const { templates, api } = await loadPreview();
  const website = { get: (key) => (key === 'files' ? [{ name: 'onsverhaal' }] : 'website') };
  const tree = templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}), collection: website });
  assert.equal(walk(tree).find((n) => n.type === 'iframe').props.src, '/onsverhaal/');
  assert.equal(api.pageFor(entryFor('onsverhaal', {}), website), '/onsverhaal/');
  assert.equal(api.pageFor(entryFor('iemand', {}), { get: () => undefined }), '/iemand/');
  assert.equal(api.pageFor(entryFor('', {}), { get: () => undefined }), null);
});

test('draft values stay visible next to the page', async () => {
  const { templates } = await loadPreview();
  const tree = templates.get('onsverhaal')({ entry: entryFor('onsverhaal', { hero: { headline: 'Nieuwe kop' } }) });
  const text = JSON.stringify(walk(tree));
  assert.match(text, /Nieuwe kop/);
  assert.match(text, /Titel/, 'field labels are translated');
});

test('every CMS collection has a preview template', async () => {
  const { templates } = await loadPreview();
  const config = parse(await readFile(new URL('../public/admin/config.yml', import.meta.url), 'utf8'));
  for (const collection of config.collections) {
    const names = collection.files ? collection.files.map((f) => f.name) : [collection.name];
    for (const name of names) assert.ok(templates.has(name), `missing preview template for ${name}`);
  }
});

test('the pane fills its full height', async () => {
  const { templates, styles } = await loadPreview();
  assert.match(styles[0].css, /margin:0/, 'the frame body margin is removed');
  assert.equal(styles[0].options.raw, true);
  const tree = templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}) });
  assert.equal(tree.props.style.height, '100vh', 'Decap renders the preview in its own frame');
  const frame = walk(tree).find((n) => n.type === 'iframe');
  assert.equal(frame.props.style.flex, '1 1 auto');
});

test('the published page is watched so the preview refreshes after a deploy', async () => {
  const { templates, timers } = await loadPreview();
  templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}) });
  assert.equal(timers.length, 1, 'exactly one watcher, however many entries are opened');
  templates.get('contact')({ entry: entryFor('contact', {}) });
  assert.equal(timers.length, 1);
  await timers[0].fn();
});

test('a click in the preview resolves to the field that produced the text', async () => {
  const { api } = await loadPreview();
  assert.deepEqual(api.anchorPath('onsverhaal.hero.eyebrow', 'onsverhaal'),
    { entry: 'onsverhaal', path: ['hero', 'eyebrow'], belongsHere: true });
  // Shared content lives in its own entry, so it cannot be edited from this page.
  assert.equal(api.anchorPath('site.header.linkLabel', 'onsverhaal').belongsHere, false);
  assert.equal(api.anchorPath('kapot', 'onsverhaal'), null);
  assert.equal(api.anchorPath('', 'onsverhaal'), null);
});

test('the field is looked up through the object it belongs to', async () => {
  const { api } = await loadPreview();
  const leaf = { id: 'eyebrow-field-2' };
  const section = { id: 'hero-field-1', querySelector: (s) => (s === '[id^="eyebrow-field-"]' ? leaf : null) };
  const editor = { querySelector: (s) => (s === '[id^="hero-field-"]' ? section : null) };
  assert.equal(api.locateField(editor, ['hero', 'eyebrow']), leaf);
  assert.equal(api.locateField(editor, ['ontbreekt']), null);
  // A path from the page can never become a selector of its own.
  assert.equal(api.locateField(editor, ['hero"], [onerror']), null);
});

test('the page frame is wired up even though it lives in another document', async () => {
  const { templates, api } = await loadPreview();
  templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}) });
  const page = pageStub();
  api.setFrame({ contentDocument: page });
  assert.equal(api.connectFrame(), true, 'the frame is connected through its ref');
  assert.equal(typeof page.handlers.click, 'function');
});

test('clicking text opens and focuses the field behind it', async () => {
  const { templates, api, editor } = await loadPreview();
  templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}) });
  const page = pageStub();
  api.setFrame({ contentDocument: page });
  api.connectFrame();

  let defaultPrevented = false;
  const text = { getAttribute: () => 'onsverhaal.hero.eyebrow', style: {} };
  await page.handlers.click({
    target: { closest: () => text },
    preventDefault: () => { defaultPrevented = true; },
  });
  assert.equal(defaultPrevented, true, 'a link in the page must not navigate away');
  assert.deepEqual(editor.focused, ['scroll', 'input']);
});

test('shared content says where it belongs instead of opening a field', async () => {
  const { templates, api, editor } = await loadPreview();
  templates.get('onsverhaal')({ entry: entryFor('onsverhaal', {}) });
  const page = pageStub();
  api.setFrame({ contentDocument: page });
  api.connectFrame();
  const text = { getAttribute: () => 'site.header.linkLabel', style: {} };
  await page.handlers.click({ target: { closest: () => text }, preventDefault: () => {} });
  assert.deepEqual(editor.focused, [], 'the field of another entry is never touched');
});
