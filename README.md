# GeluksVogel — Astro + Stacki

De website van **GeluksVogel** (`www.geluksvogel.bio`), opnieuw gebouwd als
code. Het is hetzelfde soort project als [JALO](https://github.com/m7branding/jalo):
**Astro 7.2.9, Stacki, JSON-inhoud, Astro-contentcollecties en een lokaal Decap
CMS**. Er is geen WordPress, PHP of database meer.

De oude WordPress-site was gehackt. Alle echte inhoud is uit de back-up van
28 augustus 2026 overgenomen:

* 9 pagina's, met de slideshow, tijdlijn, levensloop van hen en haan en de
  veelgestelde vragen;
* 6 recepten en 3 nieuwsberichten, op hun oude adressen;
* alle gebruikte foto's, verkleind en opnieuw gecodeerd;
* het logo als SVG.

De vormgeving volgt de oude site, met een frisser jasje: logo in het midden met
het menu eromheen, groen, karamel en crème, Nunito, en fotovlakken met het dunne
witte kader. Wat er is overgenomen, wat bewust niet en welke malware in de
back-up zat, staat in [docs/migratie-wordpress.md](docs/migratie-wordpress.md).

**Nieuw op dit project?** Volg de [handleiding voor een nieuwe collega](docs/starten-als-collega.md).
Die begint bij een lege computer en bevat een [installatieprompt voor Codex
of Claude Code](docs/setup-prompt.txt), inclusief Stacki en GitHub-toegang.

## Lokaal starten

Vereist: Node **22.12 of nieuwer**, npm en Git.

```bash
npm ci
npm run dev
```

Open **http://localhost:4321**. `npm run build` maakt de statische site in
`dist/`; met `npm run preview` bekijk je die build. Alleen `dist/` is bedoeld
voor de webserver.

## Bewerken met Stacki

```bash
npm run stacki
```

Dit haalt eerst wijzigingen op van `origin/main`, start de CMS-synchronisatie en
opent Stacki. Kies **Open Project…** en selecteer de map met dit README-bestand
en `package.json`. Stacki wordt gezocht in `~/Downloads/stacki-main`; staat het
elders, gebruik dan `STACKI_SRC=/pad/naar/stacki npm run stacki`.

Elke pagina in `src/pages/` is een layout met een platte lijst zelfsluitende
sectiecomponenten. Elke sectie heeft gedocumenteerde props met defaults uit het
bijbehorende JSON-bestand. Zo kan Stacki de secties ordenen en de inhoud tonen
in zijn eigenschappenpaneel. De recepten en verhalen delen één sjabloon,
`src/pages/[slug].astro`; hun inhoud staat in Markdown.

**Laat de synchronisatie meelopen.** Tekst die je in een prop-veld invult,
verhuist automatisch naar het juiste JSON-bestand. Ook eenvoudige
canvasbewerkingen worden teruggezet naar hun databinding. Dit werkt zoals bij
JALO; zie daar de uitgebreide uitleg.

```bash
npm run cms:sync            # eenmalig synchroniseren
npm run cms:sync -- --check # controle zonder bestanden te wijzigen
npm run stacki:check        # alle pagina's door Stacki's eigen parser
```

## Inhoud beheren

| Inhoud | Bestanden |
| --- | --- |
| Homepage | `src/data/homepage.json` |
| Overige pagina's | `src/data/onsverhaal.json`, `de-kip.json`, `de-hen.json`, `de-haan.json`, `producten.json`, `recepten.json`, `veelgesteldevragen.json`, `contact.json`, `verhalen.json`, `niet-gevonden.json` |
| Menu, footer en formuliermeldingen | `src/data/site.json` |
| Recepten (ingrediënten, bereiding, foto) | `src/content/recepten/*.md` |
| Verhalen (tekst, hoofdfoto, fotoreeks) | `src/content/verhalen/*.md` |
| Collectieschema's | `src/content.config.ts` |
| CMS-velden met Nederlandse labels | `public/admin/config.yml` (gegenereerd) |
| Oude WordPress-adressen en doorverwijzingen | `scripts/legacy-routes.mjs` |

De bestandsnaam van een recept of verhaal is het webadres:
`avocado-toast.md` wordt `/avocado-toast/`. `order` bepaalt de volgorde; de
hoogste staat bovenaan. Afbeeldingen staan in `public/assets/img/`;
uploadvelden in het CMS gebruiken `public/assets/uploads`.

Elke component importeert zijn JSON-bestand onder de alias `homepage`, net als
bij JALO. Een nieuw klantveld vraagt twee stappen: zet het veld in het
JSON-bestand en maak er een prop met default van in de component, met een
Nederlands label in het commentaar (`/** Titel. … */`). Draai daarna:

```bash
npm run cms:anchors   # data-cms-markeringen voor klikken in de CMS-preview
npm run cms:config    # public/admin/config.yml opnieuw opbouwen
```

`cms:config` leest de labels uit de componenten, dus de Decap-configuratie hoeft
niet met de hand te worden bijgewerkt. De tests bewaken dat elk veld een label
heeft en dat de configuratie actueel is.

## Lokaal CMS

Start naast `npm run dev` een tweede terminal:

```bash
npm run cms:local
```

Open **http://localhost:4321/admin/** en kies de lokale login. Deze lokale proxy
schrijft rechtstreeks naar deze werkmap. Onder **Websitepagina's** staan alle
pagina's en de algemene inhoud. **Recepten** en **Verhalen** zijn lijsten waar je
items aan kunt toevoegen. Klik in de preview op een tekst om het bijbehorende veld
te openen.

## Controles en GitHub

```bash
npm run check
npm run stacki:check
npm run cms:sync -- --check
npm run cms:config -- --check
npm test
npm run build
npm run test:site
```

GitHub Actions voert deze controles uit op pushes naar `main` en op pull
requests, met `npm run build:staging` als buildopdracht. Een geslaagde run
levert het downloadbare artifact `geluksvogel-static-site` op. Publiceren naar de
hosting staat uit tot de hosting is ingericht; zie
[docs/live-zetten.md](docs/live-zetten.md).

`npm run test:site` controleert de gebouwde site:

* elk adres van de oude WordPress-site bestaat;
* elke doorverwijzing komt uit op een bestaande pagina;
* alle lokale links, afbeeldingen en ankers werken;
* elke pagina heeft een juiste canonical en `og:url`.

## Gedrag

* **Contactformulier:** het formulier stelt een e-mail op aan
  `info@geluksvogel.bio`. Die opent in het mailprogramma van de bezoeker en
  staat ook op het scherm om te kopiëren. Er is geen formulierbackend en er
  worden geen gegevens opgeslagen.
* **Privacy:** geen cookies, geen tracking en geen externe scripts. De
  lettertypen (Nunito en Nunito Sans, OFL) staan op de eigen server.
* **Vindbaarheid:** recepten hebben schema.org-receptgegevens, verhalen
  `BlogPosting` en de homepage `Organization`. Titels en omschrijvingen komen uit
  de oude Yoast-instellingen.
* **Toegankelijkheid:** de slideshow stopt bij aanwijzen of focus, en
  animaties staan uit voor wie *minder beweging* heeft ingesteld.
