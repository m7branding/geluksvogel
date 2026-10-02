// Mark every element that renders CMS text with the field it came from, so the
// preview can send an editor to that exact field. Components bind their props to
// one JSON file, so the binding is read from the component itself.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
export const ANCHOR = 'data-cms';

export function collectBindings(source) {
  const [, frontmatter = ''] = source.split('---');
  const imports = new Map();
  for (const [, name, file] of frontmatter.matchAll(/import\s+(\w+)\s+from\s+"\.\.\/data\/([\w-]+)\.json"/g)) {
    imports.set(name, file);
  }
  const bindings = new Map();
  for (const [, prop, object, path] of frontmatter.matchAll(/^\s*(\w+)\s*=\s*(\w+)\.([\w.]+),/gm)) {
    if (imports.has(object)) bindings.set(prop, `${imports.get(object)}.${path}`);
  }
  return bindings;
}

// Walk the markup, tracking which element is open, so an expression can be tied
// to the element that renders it.
export function anchorMarkup(markup, bindings) {
  const stack = [];
  const anchors = new Map();
  const skipped = [];
  const remember = (element, prop) => {
    if (!element) return skipped.push({ prop, reason: 'no element' });
    if (anchors.has(element.start)) return skipped.push({ prop, reason: 'element already anchored' });
    anchors.set(element.start, { prop, path: bindings.get(prop), nameEnd: element.nameEnd });
  };

  for (let i = 0; i < markup.length;) {
    if (markup.startsWith('<!--', i)) { i = markup.indexOf('-->', i) + 3 || markup.length; continue; }
    if (markup[i] === '<' && markup[i + 1] === '/') {
      const end = markup.indexOf('>', i);
      stack.pop();
      i = end + 1;
      continue;
    }
    if (markup[i] === '<' && /[a-zA-Z]/.test(markup[i + 1] || '')) {
      const nameMatch = /^<([a-zA-Z][\w-]*)/.exec(markup.slice(i));
      const name = nameMatch[1];
      const nameEnd = i + nameMatch[0].length;
      let j = nameEnd;
      let quote = null;
      let depth = 0;
      let attribute = null;
      for (; j < markup.length; j++) {
        const c = markup[j];
        if (quote) { if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '{') { depth++; attribute = attribute || readAttribute(markup, j); continue; }
        if (c === '}') { depth--; continue; }
        if (c === '>' && depth === 0) break;
      }
      const selfClosing = markup[j - 1] === '/';
      const element = { name, start: i, nameEnd };
      // An image is the only attribute worth anchoring: its element has no text.
      if (attribute && attribute.name === 'src' && bindings.has(attribute.value)) remember(element, attribute.value);
      if (!selfClosing && !VOID.has(name)) stack.push(element);
      i = j + 1;
      continue;
    }
    if (markup[i] === '{') {
      const end = markup.indexOf('}', i);
      const expression = markup.slice(i + 1, end).trim();
      if (bindings.has(expression)) remember(stack[stack.length - 1], expression);
      i = end + 1;
      continue;
    }
    i++;
  }

  let out = markup;
  for (const [, { path, nameEnd }] of [...anchors].sort((a, b) => b[0] - a[0])) {
    out = `${out.slice(0, nameEnd)} ${ANCHOR}="${path}"${out.slice(nameEnd)}`;
  }
  return { markup: out, anchored: [...anchors.values()], skipped };
}

function readAttribute(markup, braceAt) {
  const before = markup.slice(0, braceAt);
  const match = /([\w-]+)=$/.exec(before);
  if (!match) return null;
  const end = markup.indexOf('}', braceAt);
  return { name: match[1], value: markup.slice(braceAt + 1, end).trim() };
}

export function addAnchors(source) {
  const bindings = collectBindings(source);
  const parts = source.split('---');
  if (parts.length < 3 || !bindings.size) return { source, anchored: [], skipped: [] };
  const markup = parts.slice(2).join('---');
  const stripped = markup.replace(new RegExp(`\\s${ANCHOR}="[^"]*"`, 'g'), '');
  const { markup: next, anchored, skipped } = anchorMarkup(stripped, bindings);
  return { source: `${parts[0]}---${parts[1]}---${next}`, anchored, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/components');
  let changed = 0;
  let total = 0;
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.astro')).sort()) {
    const path = resolve(dir, file);
    const source = await readFile(path, 'utf8');
    const result = addAnchors(source);
    total += result.anchored.length;
    if (result.source !== source) {
      changed++;
      if (check) console.error(`${basename(path)}: anchors are out of date`);
      else await writeFile(path, result.source);
    }
  }
  if (check && changed) {
    console.error(`Run "npm run cms:anchors" so every CMS field can be clicked in the preview.`);
    process.exit(1);
  }
  console.log(check ? `All ${total} preview anchors are in place.` : `Anchored ${total} fields; ${changed} components updated.`);
}
