import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';
import { renderConfig, labelsFrom, CONFIG_FILE } from './cms-config.mjs';

test('the CMS configuration matches the content files and components', async () => {
  assert.equal(await readFile(CONFIG_FILE, 'utf8'), await renderConfig(), 'run "npm run cms:config"');
});

test('labels come from the component that renders the field', () => {
  const labels = labelsFrom([`---
import homepage from "../data/de-hen.json";
interface Props {
  /** Bovenkop. De kip */
  eyebrow?: string;
}
const {
  eyebrow = homepage.levensloop.eyebrow,
} = Astro.props;
---`]);
  assert.equal(labels.get('de-hen.levensloop.eyebrow'), 'Bovenkop');
});

test('every field has a Dutch label and every image an image widget', async () => {
  const config = parse(await readFile(CONFIG_FILE, 'utf8'));
  for (const file of config.collections.find((c) => c.name === 'website').files) {
    for (const group of file.fields.filter((f) => f.name !== 'meta')) {
      for (const field of group.fields) {
        assert.notEqual(field.label, field.name, `${file.name}.${group.name}.${field.name} has no label in its component`);
        if (/^image\d*$/.test(field.name)) assert.equal(field.widget, 'image', `${file.name}.${group.name}.${field.name}`);
      }
    }
  }
});

test('recipes and stories are edited where the site reads them', async () => {
  const config = parse(await readFile(CONFIG_FILE, 'utf8'));
  for (const [name, folder] of [['recept', 'src/content/recepten'], ['verhaal', 'src/content/verhalen']]) {
    const collection = config.collections.find((c) => c.name === name);
    assert.equal(collection.folder, folder);
    const entries = (await readdir(folder)).filter((f) => f.endsWith('.md'));
    assert.ok(entries.length > 0, `${folder} has entries`);
    const source = await readFile(`${folder}/${entries[0]}`, 'utf8');
    const keys = parse(source.split('---')[1]);
    for (const key of Object.keys(keys)) assert.ok(collection.fields.some((f) => f.name === key), `${name}: ${key} is editable`);
  }
});
