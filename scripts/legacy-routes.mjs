// Every address of the old WordPress site, in one place. The build check proves
// the real pages still exist, and the server configuration sends the rest on:
// leftovers move permanently, and the spam pages the hack added are reported as
// gone so search engines drop them.

/** Pages and posts that were public on the old WordPress site and must keep their address. */
export const originalRoutes = [
  { path: '/', source: 'WordPress-pagina 556 (HOME)' },
  { path: '/onsverhaal/', source: 'WordPress-pagina 58' },
  { path: '/de-kip/', source: 'WordPress-pagina 60' },
  { path: '/de-hen/', source: 'WordPress-pagina 538' },
  { path: '/de-haan/', source: 'WordPress-pagina 541' },
  { path: '/producten/', source: 'WordPress-pagina 62' },
  { path: '/recepten/', source: 'WordPress-pagina 527' },
  { path: '/veelgesteldevragen/', source: 'WordPress-pagina 64' },
  { path: '/contact/', source: 'WordPress-pagina 68' },
  { path: '/bananen-pannenkoekjes/', source: 'WordPress-bericht 736' },
  { path: '/avocado-toast/', source: 'WordPress-bericht 778' },
  { path: '/eiersalade/', source: 'WordPress-bericht 788' },
  { path: '/griekse-frittata-met-feta/', source: 'WordPress-bericht 854' },
  { path: '/shakshuka/', source: 'WordPress-bericht 909' },
  { path: '/schuimomelet-met-kwarkvulling/', source: 'WordPress-bericht 919' },
  { path: '/mobiele-kippenkar-testfase/', source: 'WordPress-bericht 37' },
  { path: '/het-beste-ei-van-nederland/', source: 'WordPress-bericht 39' },
  { path: '/bijzonder-bezoek-in-onze-mobiele-kippenkar/', source: 'WordPress-bericht 346' },
];

/** Old addresses without a page of their own any more, and where they lead now. */
export const redirects = [
  ['/home-1/', '/'],
  ['/category/recepten/', '/recepten/'],
  ['/category/producten/', '/verhalen/'],
  ['/category/projecten/', '/verhalen/'],
  ['/category/uncategorized/', '/verhalen/'],
  ['/recepten/page/2/', '/recepten/'],
  ['/page/2/', '/recepten/'],
  ['/author/geluksvogel/', '/onsverhaal/'],
  ['/feed/', '/'],
  // Example pages of the Flothemes theme import (lorem ipsum), never real content.
  ['/default/', '/'],
  ['/608-2/', '/'],
  ['/info/', '/'],
  ['/landing/', '/'],
  ['/resources/', '/'],
  ['/thank-you-page/', '/contact/'],
];

/** Pages the attackers published or created; they answer 410 Gone. */
export const gone = [
  '/what-makes-modern-online-casinos-so-popular-1104/',
  '/lucky-hour-review-for-australian-players-12/',
  '/lucky-hour-online-casino-review-for-australian-68/',
  '/category/lucky-hour-26-12/',
  '/author/root/',
  '/author/admin/',
];

const escape = (path) => path.replace(/^\//, '').replace(/\/$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Apache rules for the list above. A trailing slash on the request is optional. */
export function legacyRewriteRules(siteUrl) {
  return [
    ...redirects.map(([from, to]) => `RewriteRule ^${escape(from)}/?$ ${siteUrl}${to} [R=301,L]`),
    ...gone.map((path) => `RewriteRule ^${escape(path)}/?$ - [G,L]`),
  ].join('\n');
}
