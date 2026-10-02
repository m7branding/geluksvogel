import { parse } from 'yaml';
import { siteUrl } from './site-url.mjs';
import { legacyRewriteRules } from './legacy-routes.mjs';

export { siteUrl };
export const siteIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function productionCmsConfig(source, siteId) {
  const id = siteId?.trim();
  if (!siteIdPattern.test(id || '')) throw new Error('DECAPBRIDGE_SITE_ID must be the GeluksVogel site UUID.');
  const config = parse(source);
  if (!Array.isArray(config?.collections) || !config.collections.length) throw new Error('CMS collections are missing.');
  config.backend = {
    name: 'git-gateway', repo: 'm7branding/geluksvogel', branch: 'main',
    identity_url: `https://auth.decapbridge.com/sites/${id}`,
    gateway_url: 'https://gateway.decapbridge.com',
    commit_messages: {
      create: 'Create {{collection}} "{{slug}}" - {{author-name}} <{{author-login}}> via DecapBridge',
      update: 'Update {{collection}} "{{slug}}" - {{author-name}} <{{author-login}}> via DecapBridge',
      delete: 'Delete {{collection}} "{{slug}}" - {{author-name}} <{{author-login}}> via DecapBridge',
      uploadMedia: 'Upload "{{path}}" - {{author-name}} <{{author-login}}> via DecapBridge',
      deleteMedia: 'Delete "{{path}}" - {{author-name}} <{{author-login}}> via DecapBridge',
    },
  };
  config.local_backend = false;
  config.site_url = siteUrl;
  config.display_url = siteUrl;
  config.locale = 'nl';
  // Direct commits to main, as in Your Earth. No pull-request permissions needed.
  delete config.publish_mode;
  return config;
}

export function siteHtaccess({ target = 'production', forceHttps = false } = {}) {
  const host = new URL(siteUrl).hostname;
  const bare = host.replace(/^www\./, '');
  // The hosting may terminate TLS before Apache. Enable these redirects only after
  // checking the proxy configuration and that both addresses reach this site; a
  // plain HTTPS=off check can otherwise loop.
  const redirect = forceHttps ? `<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/\\.well-known/acme-challenge/
RewriteRule ^ - [L]
RewriteCond %{HTTP_HOST} ^${bare.replace(/\./g, '\\.')}$ [NC]
RewriteRule ^ ${siteUrl}%{REQUEST_URI} [R=301,L]
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ ${siteUrl}%{REQUEST_URI} [R=302,L]
</IfModule>
` : '';
  // A staging address must stay out of search results and out of caches; the live
  // site must do neither, or it would never be found or kept.
  const hidden = target === 'staging' ? `Header always set X-Robots-Tag "noindex, nofollow"
Header always set Cache-Control "no-store"
` : '';
  // Addresses of the old WordPress site: leftovers move on, hack spam is gone.
  // TLS ends before Apache here, so a relative target would send visitors to
  // http first and cost them a second redirect. Name the address in full.
  const legacy = `<IfModule mod_rewrite.c>
RewriteEngine On
${legacyRewriteRules(siteUrl)}
</IfModule>
`;
  return `# Generated GeluksVogel ${target} configuration.
DirectoryIndex index.html
ErrorDocument 404 /404.html
ErrorDocument 410 /404.html
${redirect}${legacy}<IfModule mod_headers.c>
${hidden}Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
<FilesMatch "\\.(woff2|jpe?g|png|svg|webp)$">
Header set Cache-Control "public, max-age=2592000"
</FilesMatch>
</IfModule>
`;
}
