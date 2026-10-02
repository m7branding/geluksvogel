import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import YAML from 'yaml';

test('every page and shared content field is editable in Decap', async () => {
  const config = YAML.parse(await readFile('public/admin/config.yml', 'utf8'));
  const files = config.collections.find((c) => c.name === 'website').files;
  const dataFiles = (await readdir('src/data')).filter((f) => f.endsWith('.json'));
  assert.equal(files.length, dataFiles.length);
  for (const file of dataFiles) {
    const schema = files.find((f) => f.file === `src/data/${file}`);
    assert.ok(schema, `${file} is present in Decap`);
    const data = JSON.parse(await readFile(schema.file, 'utf8'));
    for (const [section, values] of Object.entries(data)) {
      const group = schema.fields.find((f) => f.name === section);
      assert.ok(group, `${file}:${section}`);
      assert.deepEqual(Object.keys(values).sort(), group.fields.map((f) => f.name).sort(), `${file}:${section} field coverage`);
    }
  }
  assert.equal(config.local_backend, true);
  for (const collection of config.collections.filter((c) => c.folder)) {
    assert.equal(collection.media_folder, '/public/assets/uploads');
  }
});
