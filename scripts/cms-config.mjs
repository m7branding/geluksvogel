// Writes public/admin/config.yml, the field list of the local Decap CMS, from
// the content itself: every key in src/data/*.json becomes a field, labelled with
// the Dutch label its component documents (`/** Titel. … */`). A new field in a
// JSON file and its component therefore needs no hand-written CMS configuration.
//
//   npm run cms:config            write the configuration
//   npm run cms:config -- --check exit 1 when the configuration is out of date
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';

export const CONFIG_FILE = 'public/admin/config.yml';

/** The order and name of every page in the CMS, with the address it edits. */
export const PAGES = [
  ['site', "Alle pagina's · Algemeen: navigatie, footer en formulieren"],
  ['homepage', '/ · Homepage'],
  ['onsverhaal', '/onsverhaal/ · Ons verhaal'],
  ['de-kip', '/de-kip/ · De kip'],
  ['de-hen', '/de-hen/ · De hen'],
  ['de-haan', '/de-haan/ · De haan'],
  ['producten', '/producten/ · Producten'],
  ['recepten', '/recepten/ · Recepten: overzicht en gedeelde teksten'],
  ['veelgesteldevragen', '/veelgesteldevragen/ · Veelgestelde vragen'],
  ['contact', '/contact/ · Contact'],
  ['verhalen', '/verhalen/ · Verhalen: overzicht en gedeelde teksten'],
  ['niet-gevonden', 'Pagina niet gevonden (404)'],
];

const SECTIONS = {
  meta: 'Zoekmachines en navigatie',
  header: 'Navigatie en mobiel menu',
  footer: 'Footer',
  forms: 'Formulieren',
  hero: 'Bovenaan de pagina',
  producten: 'Eieren en vlees',
  missie: 'Slogan (karamelkleurige band)',
  leesMeer: 'Lees meer-blokken',
  kerncijfers: 'Kerncijfers',
  recepten: 'Recepten (de vier nieuwste)',
  intro: 'Het verhaal van Yvonne',
  tijdlijn: 'Tijdlijn',
  watIs: 'Wat is GeluksVogel?',
  keuze: 'De hen en de haan',
  levensloop: 'Levensloop',
  verhaal: 'Verhaal',
  eieren: 'GeluksVogel eieren',
  vlees: 'Vleesproducten',
  overzicht: 'Overzicht',
  detail: 'Teksten op elke losse pagina',
  hennen: 'GeluksVogel hennen',
  hanen: 'GeluksVogel hanen',
  kippenkar: 'De mobiele kippenkar',
  formulier: 'Contactformulier',
  melding: 'Melding',
};

// Fields read by the page layout and its script rather than a component.
const LAYOUT_LABELS = {
  'site.forms.defaultSubject': 'Onderwerp als de bezoeker niets invult',
  'site.forms.copied': 'Melding na kopiëren',
};

const MULTILINE = /^(paragraph|answer|lead|fact|resultText|description)\d*$/;

/** `site.header.linkLabel` → `Linktekst`, read from the components' prop comments. */
export function labelsFrom(components) {
  const labels = new Map();
  for (const source of components) {
    const file = /import\s+homepage\s+from\s+"\.\.\/data\/([\w-]+)\.json"/.exec(source)?.[1];
    if (!file) continue;
    const docs = new Map();
    for (const [, label, prop] of source.matchAll(/\/\*\*\s*([^.*]+?)\.\s[^*]*\*\/\s*\n\s*(\w+)\?:/g)) docs.set(prop, label.trim());
    for (const [, prop, section, key] of source.matchAll(/^\s*(\w+)\s*=\s*homepage\.(\w+)\.(\w+),/gm)) {
      if (docs.has(prop)) labels.set(`${file}.${section}.${key}`, docs.get(prop));
    }
  }
  return labels;
}

const hint = (value) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > 100 ? `${text.slice(0, 100)}…` : text;
};

function field(file, section, key, value, labels) {
  const widget = /^image\d*$/.test(key) ? 'image' : MULTILINE.test(key) ? 'text' : 'string';
  return {
    name: key,
    label: labels.get(`${file}.${section}.${key}`) || LAYOUT_LABELS[`${file}.${section}.${key}`] || key,
    widget,
    required: false,
    hint: hint(value),
  };
}

const metaFields = [
  { name: 'title', label: 'Paginatitel', widget: 'string' },
  { name: 'description', label: 'Meta-omschrijving', widget: 'text' },
  { name: 'nav', widget: 'hidden' },
];

const folders = [
  {
    name: 'recept',
    label: 'Recepten',
    label_singular: 'Recept',
    folder: 'src/content/recepten',
    create: true,
    slug: '{{slug}}',
    summary: '{{title}}',
    sortable_fields: ['order', 'title', 'date'],
    media_folder: '/public/assets/uploads',
    public_folder: '/assets/uploads',
    fields: [
      { name: 'title', label: 'Titel', widget: 'string' },
      { name: 'order', label: 'Volgorde (hoogste staat bovenaan)', widget: 'number', value_type: 'int', min: 1 },
      { name: 'date', label: 'Datum', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'DD-MM-YYYY', time_format: false },
      { name: 'description', label: 'Omschrijving voor zoekmachines', widget: 'text' },
      { name: 'image', label: 'Foto', widget: 'image' },
      { name: 'imageAlt', label: 'Alt-tekst foto', widget: 'string' },
      { name: 'ingredients', label: 'Ingrediënten', label_singular: 'Ingrediënt', widget: 'list', field: { name: 'ingredient', label: 'Ingrediënt', widget: 'string' } },
      { name: 'body', label: 'Bereidingswijze (genummerde stappen)', widget: 'markdown', buttons: ['bold', 'italic', 'heading-three', 'numbered-list', 'bulleted-list'], editor_components: [] },
    ],
  },
  {
    name: 'verhaal',
    label: 'Verhalen',
    label_singular: 'Verhaal',
    folder: 'src/content/verhalen',
    create: true,
    slug: '{{slug}}',
    summary: '{{title}}',
    sortable_fields: ['order', 'title', 'date'],
    media_folder: '/public/assets/uploads',
    public_folder: '/assets/uploads',
    fields: [
      { name: 'title', label: 'Titel', widget: 'string' },
      { name: 'order', label: 'Volgorde (hoogste staat bovenaan)', widget: 'number', value_type: 'int', min: 1 },
      { name: 'date', label: 'Datum', widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'DD-MM-YYYY', time_format: false },
      { name: 'category', label: 'Categorie', widget: 'string' },
      { name: 'description', label: 'Korte samenvatting', widget: 'text' },
      { name: 'image', label: 'Hoofdfoto', widget: 'image' },
      { name: 'imageAlt', label: 'Alt-tekst hoofdfoto', widget: 'string' },
      { name: 'gallery', label: "Foto's", label_singular: 'Foto', widget: 'list', required: false, fields: [
        { name: 'image', label: 'Foto', widget: 'image' },
        { name: 'alt', label: 'Alt-tekst', widget: 'string' },
      ] },
      { name: 'body', label: 'Tekst', widget: 'markdown', buttons: ['bold', 'italic', 'link', 'heading-three', 'bulleted-list', 'numbered-list'], editor_components: [] },
    ],
  },
];

export async function buildConfig(root = process.cwd()) {
  const dir = path.join(root, 'src/components');
  const components = await Promise.all((await readdir(dir)).filter((f) => f.endsWith('.astro')).sort().map((f) => readFile(path.join(dir, f), 'utf8')));
  const labels = labelsFrom(components);
  const dataFiles = (await readdir(path.join(root, 'src/data'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const missing = dataFiles.filter((f) => !PAGES.some(([name]) => name === f));
  if (missing.length) throw new Error(`Add ${missing.join(', ')} to PAGES in scripts/cms-config.mjs`);
  const files = [];
  for (const [name, label] of PAGES) {
    const data = JSON.parse(await readFile(path.join(root, 'src/data', `${name}.json`), 'utf8'));
    files.push({
      name, label, file: `src/data/${name}.json`, format: 'json',
      fields: Object.entries(data).map(([section, values]) => section === 'meta'
        ? { name: 'meta', label: SECTIONS.meta, widget: 'object', fields: metaFields }
        : {
            name: section, label: SECTIONS[section] || section, widget: 'object', collapsed: true,
            fields: Object.entries(values).map(([key, value]) => field(name, section, key, value, labels)),
          }),
    });
  }
  return {
    backend: { name: 'git-gateway', branch: 'main' },
    local_backend: true,
    locale: 'nl',
    media_folder: 'public/assets/uploads',
    public_folder: '/assets/uploads',
    site_url: 'http://localhost:4321',
    display_url: 'http://localhost:4321',
    logo: { src: '/assets/brand/logo.svg', show_in_header: true },
    collections: [{ name: 'website', label: 'Websitepagina’s', files }, ...folders],
  };
}

export async function renderConfig(root = process.cwd()) {
  return `# Generated by scripts/cms-config.mjs — run "npm run cms:config" after changing src/data or a component.\n${stringify(await buildConfig(root), { lineWidth: 0 })}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = await renderConfig();
  const current = await readFile(CONFIG_FILE, 'utf8').catch(() => '');
  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error(`${CONFIG_FILE} is out of date. Run "npm run cms:config".`);
      process.exit(1);
    }
    console.log(`${CONFIG_FILE} matches the content files.`);
  } else {
    await writeFile(CONFIG_FILE, next);
    console.log(`Wrote ${CONFIG_FILE}.`);
  }
}
