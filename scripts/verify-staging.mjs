import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { siteUrl } from './prepare-staging.mjs';

const manifest = JSON.parse(await readFile('dist/deployment.json', 'utf8'));
const addresses = async (name) => lookup(name, { all: true }).then((all) => all.map((a) => a.address), () => []);

// Until the domain is moved to this server, the public address still serves the
// old website; checking it would compare this build with someone else's server.
const host = new URL(siteUrl).hostname;
if (process.env.DEPLOY_SSH_HOST) {
  const [site, server] = await Promise.all([addresses(host), addresses(process.env.DEPLOY_SSH_HOST)]);
  if (!site.some((address) => server.includes(address))) {
    console.log(`${host} resolves to ${site.join(', ') || 'nothing'} and not to ${process.env.DEPLOY_SSH_HOST} (${server.join(', ')}).`);
    console.log('The upload was verified over SSH; the public check runs once the domain is moved.');
    process.exit(0);
  }
}
const expectedCommit = process.env.GITHUB_SHA || manifest.commit;
assert.equal(manifest.commit, expectedCommit);
const deployed = await fetch(`${siteUrl}/deployment.json?commit=${expectedCommit}`, {
  signal: AbortSignal.timeout(20000), cache: 'no-store',
});
assert.ok(deployed.ok, `Deployment manifest: HTTP ${deployed.status}`);
assert.equal((await deployed.json()).commit, expectedCommit, 'The public site serves a different commit.');

const files = (await readdir('dist', { recursive: true }))
  .filter((f) => f.endsWith('.html') || f.endsWith('.pdf') || f.endsWith('.css') || f === 'assets/brand/logo.svg'
    || (manifest.cmsEnabled && ['admin/config.yml', 'admin/preview.js'].includes(f)));
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
for (let offset = 0; offset < files.length; offset += 4) {
  await Promise.all(files.slice(offset, offset + 4).map(async (file) => {
    const route = file === 'index.html' ? '' : file.replace(/\/index\.html$/, '/');
    const response = await fetch(`${siteUrl}/${route}?commit=${expectedCommit}`, {
      signal: AbortSignal.timeout(20000), cache: 'no-store',
    });
    assert.equal(response.status, 200, `${file}: HTTP ${response.status}`);
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(await readFile(`dist/${file}`)), `${file}: content differs from the build`);
  }));
}
console.log(`Verified ${files.length} public pages/styles/downloads and commit ${expectedCommit} over HTTPS.`);
