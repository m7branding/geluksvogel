// Keeps text edited in Stacki and text edited in the customer CMS in one
// place: src/data/*.json (one file per page, plus site.json). Two things Stacki does are caught here.
//
// 1. Text typed into a component's prop field lands as an attribute on the
//    page (`<Model headline="…" />`). It is moved into the CMS file and the
//    attribute is removed; left there it would override the CMS silently.
// 2. Text typed straight onto the canvas replaces the binding inside the
//    component (`<p>{sub}</p>` becomes `<p>test</p>`). The typed text is moved
//    into the CMS file and the binding is put back, using the last version of
//    the component that still had it (git history, or the watcher's memory).
//
// Which prop belongs to which CMS field is read from the components
// themselves: every `name = homepage.section.key` default is one mapping, so
// a new field needs no configuration here.
//
//   node scripts/cms-sync.mjs           move once
//   node scripts/cms-sync.mjs --watch   keep moving while Stacki is open
//   node scripts/cms-sync.mjs --check   exit 1 if a page still overrides CMS text
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CMS_FILE = 'src/data/*.json';
const COMPONENTS_DIR = 'src/components';

/** { Hero: { headline: ['hero', 'headline'], … }, … } from the components' defaults. */
export function mappingFrom(components) {
  const mapping = {};
  for (const [name, source] of Object.entries(components)) {
    for (const m of source.matchAll(/\b(\w+)(?:\s*:\s*(\w+))?\s*=\s*homepage\.(\w+)\.(\w+)(?=\s*[,}\n])/g)) {
      // `class: className = …` renames a prop; the attribute keeps the outer name.
      (mapping[name] ||= {})[m[1]] = [m[3], m[4]];
    }
  }
  return mapping;
}

export async function readComponents(root = process.cwd()) {
  const dir = path.join(root, COMPONENTS_DIR);
  const components = {};
  for (const file of await readdir(dir)) {
    if (file.endsWith('.astro')) components[file.slice(0, -6)] = await readFile(path.join(dir, file), 'utf8');
  }
  return components;
}

export async function readMapping(root = process.cwd()) {
  return mappingFrom(await readComponents(root));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templateOf = (source) => source.split(/^---$/m).slice(2).join('---');
/** Does the template use `prop` inside an expression? `class="sub"` is not a use of {sub}. */
const references = (source, prop) => {
  const id = new RegExp(`\\b${prop}\\b`);
  return (templateOf(source).match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g) || []).some((expr) => id.test(expr));
};

/**
 * Pure: repairs a component whose `{prop}` bindings were overtyped on the
 * canvas. `baseline` is the same component with its bindings intact. A line
 * that differs from the baseline only where a binding stood has that text
 * moved into the data and the baseline line put back. Anything else that
 * differs (layout, classes, a retyped line that dropped its <em>) is left
 * alone and reported under `unresolved`, so nothing typed is ever thrown away.
 */
export function syncComponent(name, source, baseline, data, mapping) {
  const props = mapping[name] || {};
  const lost = Object.keys(props).filter((prop) => references(baseline, prop) && !references(source, prop));
  if (!lost.length || source === baseline) return { source, data, moved: [], unresolved: [], removed: [] };
  const next = JSON.parse(JSON.stringify(data));
  const moved = [];
  const unresolved = [];
  const removed = [];
  const srcLines = source.split('\n');
  const baseLines = baseline.split('\n');
  for (const prop of lost) {
    // Repairing one line can restore several bindings at once.
    if (references(srcLines.join('\n'), prop)) continue;
    const token = `{${prop}}`;
    const candidates = baseLines.map((l, i) => [i, l]).filter(([, l]) => l.includes(token));
    let done = false;
    for (const [bi, bLine] of candidates) {
      // Every binding on this line becomes a capture group; the rest must match exactly.
      const names = [];
      const pattern = bLine.replace(/\{(\w+)\}/g, (m, id) => (props[id] ? (names.push(id), '\u0000') : m));
      const re = new RegExp('^' + escapeRe(pattern).split('\u0000').join('([\\s\\S]*?)') + '$');
      // Look near the same line first; Stacki does not move lines when retyping.
      const order = [bi, bi - 1, bi + 1, bi - 2, bi + 2, ...srcLines.keys()].filter((i, k, a) => i >= 0 && i < srcLines.length && a.indexOf(i) === k);
      for (const si of order) {
        const m = re.exec(srcLines[si]);
        if (!m || srcLines[si] === bLine) continue;
        names.forEach((id, k) => {
          const captured = m[k + 1];
          if (captured === `{${id}}`) return;
          const [section, key] = props[id];
          // An attribute binding becomes a quoted string: src={image} → src="/photo.jpg".
          const literal = /^(["'])([\s\S]*)\1$/.exec(captured.trim())?.[2] ?? captured.trim();
          (next[section] ||= {})[key] = decode(literal);
          moved.push({ component: name, prop: id, section, key, value: next[section][key] });
        });
        srcLines[si] = bLine;
        done = true;
        break;
      }
      if (done) break;
    }
    if (done) continue;
    // No line matches the binding's old shape. Typed text in its place must be
    // dealt with by hand; an element or attribute that simply went away is a
    // design choice and only leaves the CMS field unused.
    const typed = candidates.some(([bi, bLine]) => {
      const tag = /^\s*<([\w-]+)/.exec(bLine)?.[1];
      const near = [bi - 2, bi - 1, bi, bi + 1, bi + 2].map((i) => srcLines[i]).filter(Boolean);
      const line = tag ? near.find((l) => new RegExp(`^\\s*<${tag}\\b`).test(l)) : near[2];
      if (!line) return false;
      const text = line.replace(/<[^>]*>/g, '').trim();
      const literals = [...line.matchAll(/=\s*"([^"]*)"/g)].map((m) => m[1]).filter((v) => v && !bLine.includes(`"${v}"`));
      return text.length > 0 || literals.length > 0;
    });
    (typed ? unresolved : removed).push({ component: name, prop });
  }
  return { source: srcLines.join('\n'), data: next, moved, unresolved, removed };
}

/** The last committed version of a component that still referenced `prop`. */
export function baselineFromGit(root, name, props) {
  const rel = `${COMPONENTS_DIR}/${name}.astro`;
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let shas = [];
  try { shas = git(['log', '-n', '30', '--format=%H', '--', rel]).trim().split('\n').filter(Boolean); } catch { return null; }
  for (const sha of shas) {
    try {
      const text = git(['show', `${sha}:${rel}`]);
      if (props.every((prop) => references(text, prop))) return text;
    } catch { /* file did not exist there */ }
  }
  return null;
}

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function coerce(value, like) {
  if (typeof like === 'boolean') return value === 'true' ? true : value === 'false' ? false : value;
  if (typeof like === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Pure: returns the page with CMS props removed, the updated data, and what
 * moved. Only plain string attributes move — `{expr}` values stay untouched.
 */
export function syncPage(page, data, mapping) {
  const moved = [];
  const next = JSON.parse(JSON.stringify(data));
  const out = page.replace(/<([A-Z]\w*)(\s[^>]*?)?\s*\/>/g, (tag, name, attrs = '') => {
    const props = mapping[name];
    if (!props || !attrs) return tag;
    const kept = attrs.replace(/\s+(\w+)="([^"]*)"/g, (attr, prop, raw) => {
      const target = props[prop];
      if (!target) return attr;
      const [section, key] = target;
      const value = coerce(decode(raw), next[section]?.[key]);
      (next[section] ||= {})[key] = value;
      moved.push({ component: name, prop, section, key, value });
      return '';
    });
    return kept.trim() ? `<${name} ${kept.trim()} />` : `<${name} />`;
  });
  return { page: out, data: next, moved };
}

function stringify(data, source) {
  const indent = /^( +)"/m.exec(source)?.[1].length ?? 2;
  return JSON.stringify(data, null, indent) + (source.endsWith('\n') ? '\n' : '');
}

/** Resolve each component's CMS file from its actual import, never its name. */
export function cmsFileFrom(source) {
  const match = /import\s+homepage\s+from\s+['"]\.\.\/data\/([a-zA-Z0-9_-]+)\.json['"]/.exec(source);
  return match ? `src/data/${match[1]}.json` : null;
}

async function astroFiles(root, dir) {
  const files = await readdir(path.join(root, dir), { recursive: true });
  return files.filter((f) => f.endsWith('.astro')).sort().map((f) => `${dir}/${f}`);
}

/** Plan all edits first. Save data before removing the page/component override. */
export async function syncOnce(root = process.cwd(), { write = true, baselines = {} } = {}) {
  const components = await readComponents(root);
  const groups = {};
  for (const [name, source] of Object.entries(components)) {
    const file = cmsFileFrom(source);
    if (file) (groups[file] ||= {})[name] = source;
  }
  const templates = {};
  for (const rel of await astroFiles(root, 'src/pages')) {
    templates[rel] = await readFile(path.join(root, rel), 'utf8');
  }
  const originals = { ...templates };
  const componentWrites = {};
  const dataWrites = {};
  const allMoved = [];
  const unresolved = [];
  const removed = [];
  for (const [file, group] of Object.entries(groups)) {
    const mapping = mappingFrom(group);
    const cmsSource = await readFile(path.join(root, file), 'utf8');
    let data = JSON.parse(cmsSource);
    const moved = [];
    for (const [rel, page] of Object.entries(templates)) {
      const result = syncPage(page, data, mapping);
      data = result.data;
      templates[rel] = result.page;
      moved.push(...result.moved.map((m) => ({ ...m, page: rel, file })));
    }
    for (const [name, source] of Object.entries(group)) {
      const props = Object.keys(mapping[name] || {});
      if (!props.length) continue;
      const intact = props.filter((prop) => references(source, prop));
      if (intact.length === props.length) { baselines[name] = source; continue; }
      const wanted = props.filter((p) => !intact.includes(p));
      let baseline = baselines[name];
      if (!baseline || !wanted.every((p) => references(baseline, p))) baseline = baselineFromGit(root, name, wanted);
      if (!baseline) continue;
      const result = syncComponent(name, source, baseline, data, mapping);
      data = result.data;
      moved.push(...result.moved.map((m) => ({ ...m, page: `${COMPONENTS_DIR}/${name}.astro`, file })));
      unresolved.push(...result.unresolved.map((m) => ({ ...m, file })));
      removed.push(...result.removed.map((m) => ({ ...m, file })));
      if (result.moved.length) {
        componentWrites[`${COMPONENTS_DIR}/${name}.astro`] = result.source;
        baselines[name] = result.source;
      }
    }
    // Two different overrides for shared content need a human choice.
    const values = new Map();
    for (const edit of moved) {
      const key = `${edit.section}.${edit.key}`;
      if (values.has(key) && values.get(key) !== edit.value) {
        throw new Error(`Conflicting Stacki edits for ${file}: ${key}. Keep one value before syncing.`);
      }
      values.set(key, edit.value);
    }
    if (moved.length) dataWrites[file] = stringify(data, cmsSource);
    allMoved.push(...moved);
  }
  if (write) {
    for (const [rel, source] of Object.entries(dataWrites)) await writeFile(path.join(root, rel), source);
    for (const [rel, source] of Object.entries(templates)) {
      if (source !== originals[rel]) await writeFile(path.join(root, rel), source);
    }
    for (const [rel, source] of Object.entries(componentWrites)) await writeFile(path.join(root, rel), source);
  }
  return Object.assign(allMoved, { unresolved, removed });
}

function notify(title, text) {
  if (process.platform !== 'darwin') return;
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(text)} with title ${JSON.stringify(title)}`], { stdio: 'ignore' });
  } catch { /* notifications are a courtesy */ }
}

function report(moved) {
  for (const m of moved) {
    const shown = String(m.value).length > 60 ? String(m.value).slice(0, 57) + '…' : m.value;
    console.log(`${m.component}.${m.prop} → ${m.file || CMS_FILE}: ${m.section}.${m.key}: ${JSON.stringify(shown)}`);
  }
  for (const u of moved.unresolved || []) {
    console.error(`${u.component}: {${u.prop}} was overtyped and the text could not be matched. Put {${u.prop}} back by hand and move the text to ${CMS_FILE}.`);
  }
  for (const r of moved.removed || []) {
    console.log(`${r.component}: {${r.prop}} is no longer rendered — the CMS field stays but does nothing until a design puts it back.`);
  }
  if (moved.length) notify('CMS sync', `${moved.length} tekst${moved.length === 1 ? '' : 'en'} opgeslagen in het CMS-bestand.`);
  if (moved.unresolved?.length) notify('CMS sync: handmatig nodig', moved.unresolved.map((u) => `${u.component}: {${u.prop}}`).join(', '));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode === '--check') {
    const moved = await syncOnce(process.cwd(), { write: false });
    if (moved.length || moved.unresolved.length) {
      console.error('Text bypasses the CMS file. Run `npm run cms:sync` to move it there:');
      report(moved);
      process.exit(1);
    }
    console.log('No Stacki text overrides bypass the page content files.');
  } else if (mode === '--watch') {
    let timer = null;
    let running = false;
    let pending = false;
    const baselines = {};
    const run = async () => {
      if (running) { pending = true; return; }
      running = true;
      try {
        const moved = await syncOnce(process.cwd(), { baselines });
        if (moved.length || moved.unresolved.length) report(moved);
      } catch (err) { console.error(err.message); }
      finally {
        running = false;
        if (pending) { pending = false; schedule(); }
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 750); };
    // Directory watches also survive the atomic file replacement editors use.
    watch(path.join(process.cwd(), 'src'), { recursive: true }, (_event, filename) => {
      if (filename?.endsWith('.astro')) schedule();
    });
    console.log(`Watching all page/component files — Stacki text moves into ${CMS_FILE}.`);
    await run();
    await new Promise(() => {});
  } else {
    const moved = await syncOnce();
    moved.length || moved.unresolved.length ? report(moved) : console.log('Nothing to move.');
    if (moved.unresolved.length) process.exit(1);
  }
}
