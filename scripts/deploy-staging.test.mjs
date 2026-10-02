import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { productionCmsConfig } from './cms-production.mjs';

const script = fileURLToPath(new URL('./deploy-staging.sh', import.meta.url));
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'geluksvogel-deploy-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'bin'));
  await writeFile(join(root, 'bin/ssh'), '#!/bin/sh\nprintf attempted > "$SSH_MARKER"\nexit 42\n', { mode: 0o755 });
  const env = {
    ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`,
    SSH_MARKER: join(root, 'ssh-attempted'), DEPLOY_SSH_HOST: 'web0169.zxcs.nl',
    DEPLOY_SSH_USER: 'u77700p457836', DEPLOY_SSH_PORT: '7685',
    DEPLOY_WEBROOT: '/domains/geluksvogel.bio/public_html',
    DEPLOY_KEY_FILE: '/unused/key', DEPLOY_KNOWN_HOSTS_FILE: '/unused/hosts',
    DEPLOY_RELEASE_ID: 'test-release', GITHUB_SHA: 'a'.repeat(40),
  };
  return { root, env };
}

test('deployment refuses the agency webroot and traversal before making any SSH connection', async (t) => {
  const { root, env } = await fixture(t);
  for (const webroot of ['/domains/geluksvogel.bio/public_html/..', '/domains/another-client.com/public_html', '/domains/m7hosting.online/public_html/jalo', '/domains/geluksvogel.bio', '/home/other/domains/geluksvogel.bio/public_html']) {
    const result = spawnSync('bash', [script], { cwd: root, env: { ...env, DEPLOY_WEBROOT: webroot }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing upload outside the GeluksVogel documentroot/);
  }
  await assert.rejects(access(env.SSH_MARKER));
});

test('deployment refuses a build containing the local CMS before making any SSH connection', async (t) => {
  const { root, env } = await fixture(t);
  await mkdir(join(root, 'dist/admin'), { recursive: true });
  for (const file of ['index.html', '.htaccess', 'admin/index.html']) await writeFile(join(root, 'dist', file), 'fixture');
  await writeFile(join(root, 'dist/admin/config.yml'), 'local_backend: true\n');
  await writeFile(join(root, 'dist/deployment.json'), JSON.stringify({
    target: 'production', siteUrl: 'https://geluksvogel.bio', commit: env.GITHUB_SHA, cmsEnabled: false,
  }));
  const result = spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  await assert.rejects(access(env.SSH_MARKER));
});

test('a valid online CMS may deploy, but wrong-repository and local-backend builds cannot connect', async (t) => {
  const { root, env } = await fixture(t);
  const siteId = '11111111-2222-4333-8444-555555555555';
  await mkdir(join(root, 'dist/admin'), { recursive: true });
  for (const file of ['index.html', '.htaccess', 'admin/index.html', 'admin/preview.js']) await writeFile(join(root, 'dist', file), 'fixture');
  await writeFile(join(root, 'dist/deployment.json'), JSON.stringify({
    target: 'production', siteUrl: 'https://geluksvogel.bio', commit: env.GITHUB_SHA,
    cmsEnabled: true, cmsSiteId: siteId,
  }));
  const config = productionCmsConfig('collections:\n  - name: website\n', siteId);
  for (const bad of [
    { ...config, backend: { ...config.backend, repo: 'm7branding/your-earth-site' } },
    { ...config, local_backend: true },
    { ...config, backend: { ...config.backend, identity_url: 'http://localhost:9999' } },
  ]) {
    await writeFile(join(root, 'dist/admin/config.yml'), stringify(bad));
    const result = spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    await assert.rejects(access(env.SSH_MARKER));
  }
  await writeFile(join(root, 'dist/admin/config.yml'), stringify(config));
  const valid = spawnSync('bash', [script], { cwd: root, env, encoding: 'utf8' });
  assert.equal(valid.status, 42, valid.stderr); // Only the stub SSH transport runs.
  await access(env.SSH_MARKER);
});

test('the documentroot named by the server is held to the same allowlist', async (t) => {
  const { root, env } = await fixture(t);
  const siteId = '11111111-2222-4333-8444-555555555555';
  await mkdir(join(root, 'dist/admin'), { recursive: true });
  for (const file of ['index.html', '.htaccess', 'admin/index.html', 'admin/preview.js']) await writeFile(join(root, 'dist', file), 'fixture');
  await writeFile(join(root, 'dist/deployment.json'), JSON.stringify({
    target: 'production', siteUrl: 'https://geluksvogel.bio', commit: env.GITHUB_SHA,
    cmsEnabled: true, cmsSiteId: siteId,
  }));
  await writeFile(join(root, 'dist/admin/config.yml'), stringify(productionCmsConfig('collections:\n  - name: website\n', siteId)));

  // A server that answers with any other path must not be followed.
  await writeFile(join(root, 'bin/ssh'), '#!/bin/sh\nprintf attempted > "$SSH_MARKER"\necho "$STUB_RESOLVED"\n', { mode: 0o755 });
  const hostile = spawnSync('bash', [script], { cwd: root, env: { ...env, STUB_RESOLVED: '/etc' }, encoding: 'utf8' });
  assert.equal(hostile.status, 1);
  assert.match(hostile.stderr, /outside the GeluksVogel documentroot/);

  // The full path under the home directory is the form this hosting really has.
  const home = `/home/${env.DEPLOY_SSH_USER}/domains/geluksvogel.bio/public_html`;
  const accepted = spawnSync('bash', [script], { cwd: root, env: { ...env, STUB_RESOLVED: home }, encoding: 'utf8' });
  assert.match(accepted.stdout, new RegExp(`Publishing to ${home}`));
});
