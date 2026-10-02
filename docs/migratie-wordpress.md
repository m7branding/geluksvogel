# Van WordPress naar code: wat er is overgenomen

De oude site `www.geluksvogel.bio` draaide op WordPress met het Flothemes-thema
**Mono** en de Flo Flex Builder. De site is gehackt. Deze repository vervangt hem
volledig; er draait geen PHP, database of WordPress meer.

Bron: de Plesk/WP Toolkit-back-up `geluksvogel.bio__2026-08-28T13_06_38+0200.zip`
(28 augustus 2026, ±458 MB). De back-up staat als **concept-release**
`backup-2026-08-28` op deze repository. Die release is niet openbaar. Verwijder
hem als hij niet meer nodig is; hij bevat de database met klantberichten uit het
contactformulier en wachtwoord-hashes.

## Werkwijze

1. De back-up is uitgepakt in een afgeschermde omgeving en vergeleken met een
   schone WordPress 6.9.7 (zie *Gevonden malware* hieronder).
2. Een opgeschoonde kopie is lokaal gestart: schone WordPress, het Mono-thema
   zonder achterdeur, alleen de Flo-plug-ins, en alleen afbeeldingen uit de
   uploadmap. Van elke pagina zijn screenshots en de opgebouwde HTML gemaakt.
3. Teksten zijn letterlijk uit die pagina's en de database overgenomen. De
   SEO-titels en -omschrijvingen komen uit Yoast.
4. Alleen de afbeeldingen die echt op de pagina's stonden, zijn meegenomen. Ze
   zijn opnieuw gecodeerd en verkleind, van ±1 MB naar meestal 100–300 kB. Door
   het hercoderen kan er ook niets in een afbeeldingsbestand zijn achtergebleven.
5. Het logo is van de PNG overgetrokken naar een scherp SVG-bestand.

## Overgenomen

| Oud adres | Nieuw | Bron |
| --- | --- | --- |
| `/` | `src/pages/index.astro` · `src/data/homepage.json` | Slideshow (5 foto's), eieren/vlees, slogan, lees meer, kerncijfers, recepten |
| `/onsverhaal/` | `onsverhaal.json` | Verhaal van Yvonne, tijdlijn (15 momenten), *Wat is GeluksVogel?* |
| `/de-kip/` | `de-kip.json` | Keuze hen/haan |
| `/de-hen/` | `de-hen.json` | Levensloop (6 stappen) en tekst |
| `/de-haan/` | `de-haan.json` | Levensloop (5 stappen), tekst en *Wist je dat…* |
| `/producten/` | `producten.json` | Eierdoosje, wikkel, hanensoep, Man in de pan |
| `/recepten/` | `recepten.json` + `src/content/recepten/` | 6 recepten |
| `/veelgesteldevragen/` | `veelgesteldevragen.json` | 12 vragen in 3 groepen |
| `/contact/` | `contact.json` | Formulier en e-mailadres |
| 3 nieuwsberichten | `src/content/verhalen/` | Op hun oude adres, plus het nieuwe overzicht `/verhalen/` |

Alle recepten en berichten houden hun oude adres, bijvoorbeeld
`/avocado-toast/`. Oude categorie-, auteur- en demopagina's sturen met een 301 door
naar de juiste nieuwe pagina. De lijst staat in `scripts/legacy-routes.mjs`; de
build controleert dat elk oud adres en elk doorstuurdoel bestaat.

## Bewust niet overgenomen

* **Spam van de hack:** drie casino-artikelen (december 2025), de categorie
  *lucky-hour-26-12* en de auteurs `root` en `admin`. Die adressen geven
  **410 Gone**, zodat Google ze uit de zoekresultaten haalt.
* **Demopagina's van het thema:** *Default*, *Info*, *Landing*, *Resources*,
  *Thank You Page* en een naamloze pagina, alle met lorem ipsum. Ze sturen door.
* **Concepten:** het recept *Broodje roerei* en de pagina *GeluksVogel
  ondernemer* waren nooit gepubliceerd en hadden geen inhoud.
* **Formulierberichten:** 85 ingezonden contactberichten. Dat zijn
  persoonsgegevens; ze staan alleen in de back-up.
* **Instagram-feed en cookiemelding:** de feed werkte al niet meer (op de oude
  site stond letterlijk `[instagram-feed]`). Er staat nu een link naar
  Instagram. De nieuwe site plaatst geen cookies en laadt niets van derden:
  lettertypen staan op de eigen server. Een cookiemelding is dus niet nodig.

## Aanpassingen aan de inhoud

* Recepten: de ingrediënten stonden er met spaties tussen elke letter
  (`2 g e l u k s e i e r e n`). Ze staan nu gewoon als lijst.
* FAQ: het antwoord op *Wat eten jullie hanen?* was hetzelfde als bij de hennen
  en is zo overgenomen. In het laatste haan-antwoord ontbrak een werkwoord
  (*mag … leven*).
* De hen: boven de alinea's over de eerste eitjes staat nu de tussenkop
  *Henneneitjes*.
* De homepage, de verhalenpagina en de 404-pagina hebben een korte nieuwe
  inleiding of omschrijving gekregen.

**Nog door de klant te controleren** (overgenomen zoals het er stond):

* *Eiersalade*: bij de ingrediënten staat avocado, bij de bereiding mayonaise.
* *Griekse frittata*: de bereiding noemt een ui die niet bij de ingrediënten staat.
* *Verkooppunten*: het bericht uit 2018 zegt dat alle adressen op de website
  staan. Die lijst bestaat niet meer.
* Kerncijfers op de homepage (8 boeren, 45.000 doosjes retour) en de regio's van
  de kippenkarren in de FAQ zijn van 2021–2022.

## Gevonden malware

De WordPress-kernbestanden waren schoon. In `wp-content` zat het volgende:

* **740 verborgen Linux-programma's** (ELF-binaries met namen als
  `gnome-cache.so`, `tracker-helper.daemon` en `ssh-plugin.daemon`). Ze zaten
  in alle thema's, in de Flo-plug-ins, in `wp-content/languages`, in
  `wp-content/maintenance` en in `wp-content/uploads/2019`.
* **Achterdeur in `themes/mono/functions.php`:** maakt een verborgen beheerder
  `root` aan, met e-mailadres `admin@wordpress.com`, en verbergt die in het
  gebruikersoverzicht.
* **Kwaadaardig script:** `content-website-analytics.com/script.js` werd via
  `functions.php` en `masonry.pkgd.min.js` in elke pagina geladen.
* **Twee onbekende beheerders** in de database: `root` (23 december 2025) en
  `admin` (27 februari 2026).

Niets daarvan staat in deze repository. De nieuwe site is statische HTML; er is
niets meer om in te breken.

**Advies voor de oude hosting**, die nog besmet is:

1. Zet de oude WordPress-installatie offline en wis de map `httpdocs` helemaal.
   Herstel niets uit de back-up.
2. Wijzig het wachtwoord van de hosting, de database, FTP/SSH en de mailboxen van
   `geluksvogel.bio`.
3. Plaats de nieuwe site op een schone hosting, of in een geleegde webroot (zie
   [live-zetten.md](live-zetten.md)).
4. Vraag in Google Search Console een nieuwe crawl aan en controleer na een paar
   weken of de casinopagina's uit de index zijn.
