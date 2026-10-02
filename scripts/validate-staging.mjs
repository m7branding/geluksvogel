import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { siteUrl, siteIdPattern } from './cms-production.mjs';

export function validateStagingBuild(dir, expectedCommit, expectedTarget = 'production') {
  const file = (name) => resolve(dir, name);
  const manifest = JSON.parse(readFileSync(file('deployment.json'), 'utf8'));
  assert.match(expectedCommit, /^[a-f0-9]{40}$/);
  assert.equal(manifest.commit, expectedCommit);
  assert.equal(manifest.target, expectedTarget);
  assert.equal(manifest.siteUrl, siteUrl);
  assert.equal(typeof manifest.cmsEnabled, 'boolean');
  for (const name of ['index.html', 'admin/index.html', '.htaccess']) assert.ok(existsSync(file(name)), `Missing ${name}`);
  if (manifest.cmsEnabled) {
    assert.match(manifest.cmsSiteId, siteIdPattern);
    const config = parse(readFileSync(file('admin/config.yml'), 'utf8'));
    assert.equal(config.local_backend, false, 'Refusing a local CMS backend');
    assert.equal(config.backend.name, 'git-gateway');
    assert.equal(config.backend.repo, 'm7branding/geluksvogel');
    assert.equal(config.backend.branch, 'main');
    assert.equal(config.backend.identity_url, `https://auth.decapbridge.com/sites/${manifest.cmsSiteId}`);
    assert.equal(config.backend.gateway_url, 'https://gateway.decapbridge.com');
    assert.equal(config.site_url, siteUrl);
    assert.equal(config.display_url, siteUrl);
    assert.ok(config.collections?.length, 'Missing CMS collections');
    assert.ok(existsSync(file('admin/preview.js')), 'Missing CMS preview');
  } else {
    assert.equal(existsSync(file('admin/config.yml')), false, 'Unconfigured CMS cannot be published');
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.env.DEPLOY_TARGET === 'staging' ? 'staging' : 'production';
  validateStagingBuild('dist', process.env.GITHUB_SHA, target);
  console.log(`Commit, target ${target} and CMS configuration validated.`);
}
