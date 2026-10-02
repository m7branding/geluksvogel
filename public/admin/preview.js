// Show the page being edited next to the draft values, and let a click in the
// page open the field that produced the text.
//
// This script is loaded by the admin page, so `document` is the editor document.
// Decap renders the preview inside its own frame, so the frame element is kept
// from a ref: looking it up by id in the editor document would never find it.
const h = window.h;
const styleId = 'geluksvogel-cms-anchor-style';
let frame = null;
let statusNode = null;
let entryName = 'homepage';

// A file entry edits exactly one page; the shared entry appears on all of them,
// so the homepage stands in for it.
const pageOf = { homepage: '/', site: '/', 'niet-gevonden': '/404.html' };
const entryNameOf = (entry) => entry.get('slug') || 'homepage';

// A recipe or story has a page of its own at /<file name>/, but only once it has
// been saved: a new item has no file name yet and shows its own content instead.
const pageFor = (entry, collection) => {
  if (collection && !collection.get('files')) {
    const slug = entry.get('slug');
    return slug ? `/${slug}/` : null;
  }
  const name = entryNameOf(entry);
  return pageOf[name] || `/${name}/`;
};

window.CMS.registerPreviewStyle('html,body{margin:0;padding:0;height:100%}', { raw: true });

const setStatus = (text) => {
  if (statusNode) statusNode.textContent = text;
};

const reloadFrame = () => {
  if (frame && frame.contentWindow) frame.contentWindow.location.reload();
};

const anchorPath = (anchor, entry) => {
  const parts = String(anchor || '').split('.');
  if (parts.length < 2) return null;
  const [file, ...path] = parts;
  return { entry: file, path, belongsHere: file === entry };
};

const isVisible = (element) => Boolean(element && element.offsetParent);

// Decap gives every control an id of "<field name>-field-<n>" and nests the
// controls of an object inside that object's control, so the path can be walked.
const locateField = (editor, path) => {
  let scope = editor;
  let target = null;
  for (const part of path) {
    if (!/^[\w-]+$/.test(part)) return null;
    target = scope.querySelector(`[id^="${part}-field-"]`);
    if (!target) return null;
    scope = target;
  }
  return target;
};

const hiddenAncestor = (element) => {
  for (let node = element; node && node.parentElement; node = node.parentElement) {
    const view = node.ownerDocument.defaultView;
    if (view.getComputedStyle(node).display === 'none') return node;
  }
  return null;
};

const highlight = (element, colour) => {
  const previous = element.style.outline;
  element.style.outline = `2px solid ${colour}`;
  element.style.outlineOffset = '2px';
  setTimeout(() => { element.style.outline = previous; }, 1200);
};

const openField = async (editor, path) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const target = locateField(editor, path);
    if (!target) return false;
    if (isVisible(target)) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const input = target.matches('input, textarea') ? target : target.querySelector('input, textarea');
      if (input) input.focus();
      highlight(target, '#3b6939');
      return true;
    }
    // A collapsed section hides its fields; open it and look again.
    const hidden = hiddenAncestor(target);
    const button = hidden && hidden.parentElement && hidden.parentElement.querySelector('[data-testid="expand-button"]');
    if (!button) return false;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return false;
};

const onPageClick = async (event) => {
  const element = event.target.closest && event.target.closest('[data-cms]');
  if (!element) return;
  event.preventDefault();
  const anchor = anchorPath(element.getAttribute('data-cms'), entryName);
  if (!anchor) return;
  if (!anchor.belongsHere) {
    highlight(element, '#d08b00');
    setStatus(`Deze tekst hoort bij "${anchor.entry}"; open dat item om hem te wijzigen.`);
    return;
  }
  const opened = await openField(document, anchor.path);
  highlight(element, opened ? '#c5a081' : '#d08b00');
  setStatus(opened ? '' : 'Het bijbehorende veld is niet gevonden.');
};

// The frame reloads on every publish, which drops the listener, so keep checking.
const connectFrame = () => {
  const page = frame && frame.contentDocument;
  if (!page || !page.body || page.getElementById(styleId)) return false;
  const style = page.createElement('style');
  style.id = styleId;
  style.textContent = '[data-cms]{cursor:pointer}[data-cms]:hover{outline:2px dashed #c5a081;outline-offset:2px}';
  page.head.appendChild(style);
  page.addEventListener('click', onPageClick);
  return true;
};

// A CMS change is published by GitHub Actions and takes about a minute; watch the
// published commit so the page refreshes itself once the deploy has landed.
let watching = false;
const watchFrame = () => {
  if (watching) return;
  watching = true;
  let known = null;
  let ticks = 0;
  setInterval(async () => {
    connectFrame();
    if (!frame || (ticks += 1) % 20) return;
    try {
      const response = await fetch('/deployment.json', { cache: 'no-store' });
      if (!response.ok) return;
      const { commit } = await response.json();
      if (known && commit !== known) reloadFrame();
      known = commit;
    } catch {
      // Offline or not published yet; try again on the next tick.
    }
  }, 1000);
};

const labels = {
  title: 'Paginatitel', description: 'Omschrijving', headline: 'Titel',
  highlight: 'Uitgelichte tekst', eyebrow: 'Bovenkop', paragraph: 'Tekst',
  subheading: 'Subtitel', lead: 'Inleiding', note: 'Toelichting', text: 'Tekst',
  href: 'Link', image: 'Afbeelding', imageAlt: 'Alt-tekst', question: 'Vraag',
  answer: 'Antwoord', buttonLabel: 'Knoptekst', linkLabel: 'Linktekst',
  date: 'Datum', week: 'Week', number: 'Getal', label: 'Omschrijving',
  fact: 'Weetje', ingredients: 'Ingrediënten', gallery: "Foto's", body: 'Tekst',
};
const label = (key) => labels[key.replace(/\d+$/, '')] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
const renderValue = (key, value) => {
  if (key === 'nav') return null;
  if (Array.isArray(value)) return h('div', { key, style: { marginBottom: '16px' } },
    h('strong', { style: { fontSize: '12px', textTransform: 'uppercase' } }, label(key)),
    h('ul', { style: { margin: '4px 0', paddingLeft: '18px' } }, value.map((item, i) => h('li', { key: i },
      item && typeof item === 'object' ? (item.alt || item.image || '') : String(item))))
  );
  if (value && typeof value === 'object') return h('section', { key, style: { borderTop: '1px solid #ddd', paddingTop: '16px' } },
    h('h2', {}, key === 'meta' ? 'Pagina-informatie' : label(key)),
    Object.entries(value).map(([name, val]) => renderValue(name, val))
  );
  return h('div', { key, style: { marginBottom: '16px' } },
    h('strong', { style: { fontSize: '12px', textTransform: 'uppercase' } }, label(key)),
    /^image\d*$/.test(key) && value
      ? h('img', { src: value, alt: '', style: { display: 'block', maxWidth: '100%', maxHeight: '240px', marginTop: '8px' } })
      : h('p', { style: { margin: '4px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, String(value ?? ''))
  );
};
const Preview = ({ entry, collection }) => {
  const data = entry.get('data').toJS();
  const fields = Object.entries(data).map(([key, value]) => renderValue(key, value));
  const page = pageFor(entry, collection);
  if (!page) {
    return h('article', { style: { padding: '16px 20px', color: '#3b6939', lineHeight: 1.6, fontFamily: 'system-ui' } },
      h('h1', { style: { fontSize: '20px' } }, data.title || 'Nieuw onderdeel'),
      h('p', { style: { fontSize: '13px', color: '#555' } },
        'Dit onderdeel heeft nog geen eigen pagina. Na opslaan en publiceren zie je hier de pagina zelf.'),
      fields);
  }
  entryName = entryNameOf(entry);
  watchFrame();
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100vh', boxSizing: 'border-box', fontFamily: 'system-ui' } },
    h('div', { style: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', borderBottom: '1px solid #ddd', color: '#3b6939', fontSize: '13px' } },
      h('strong', {}, 'Pagina'),
      h('span', { style: { color: '#555' } }, 'laatst gepubliceerde versie · klik tekst om het veld te openen'),
      h('span', { ref: (node) => { statusNode = node; }, style: { color: '#d08b00' } }),
      h('button', {
        type: 'button', onClick: reloadFrame,
        style: { marginLeft: 'auto', border: '1px solid #3b6939', background: '#fff', color: '#3b6939', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' },
      }, 'Vernieuwen')
    ),
    h('iframe', {
      key: 'geluksvogel-live-preview', src: page, title: 'Websitepreview',
      ref: (node) => { frame = node; },
      style: { flex: '1 1 auto', width: '100%', height: '100%', border: '0', background: '#fff' },
    }),
    h('details', { style: { flex: '0 1 auto', borderTop: '1px solid #ddd', padding: '12px', color: '#3b6939', lineHeight: 1.6, maxHeight: '40%', overflow: 'auto' } },
      h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'Inhoud van dit concept'),
      h('p', { style: { fontSize: '13px', color: '#555' } },
        'Wijzigingen hierboven verschijnen in de pagina zodra je publiceert; dat duurt ongeveer een minuut.'),
      fields
    )
  );
};
["site","homepage","onsverhaal","de-kip","de-hen","de-haan","producten","recepten","veelgesteldevragen","contact","verhalen","niet-gevonden","recept","verhaal"].forEach((name) => window.CMS.registerPreviewTemplate(name, Preview));

// Exposed so the preview can be tested without a browser.
window.GELUKSVOGEL_PREVIEW = { pageFor, entryNameOf, anchorPath, locateField, connectFrame, setFrame: (node) => { frame = node; } };
