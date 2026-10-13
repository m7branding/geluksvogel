# GeluksVogel live zetten

De website komt op **https://geluksvogel.bio** (zonder www). Dat adres staat op één
plek: `scripts/site-url.mjs`. De build, de deploycontroles en de metadata van de
pagina's lezen het daar.

De publicatie werkt zoals bij JALO. GitHub Actions bouwt elke push naar `main`,
controleert de build en uploadt die via SSH naar een Vimexx-hostingpakket
(`web…zxcs.nl`). Zolang `VIMEXX_DEPLOY_ENABLED` niet op `true` staat, wordt er
niets gepubliceerd. Een geslaagde run levert dan alleen het downloadbare artifact
`geluksvogel-static-site` op: de complete `dist/`-map.

> **Gebruik de oude, gehackte webruimte niet zomaar opnieuw.** Wis de oude
> `httpdocs` helemaal en wijzig alle wachtwoorden, of kies een nieuw pakket.
> Zie [migratie-wordpress.md](migratie-wordpress.md).

## Snel: handmatig uploaden met een zip

Voor een eerste livegang zonder GitHub-koppeling:

```bash
npm ci
npm run zip
```

Dat bouwt de site met alle serverbestanden en maakt `geluksvogel-live.zip`. Upload
die zip in Vimexx (DirectAdmin → **Bestandsbeheer**) naar
`domains/geluksvogel.bio/public_html` en pak hem daar uit. `index.html` moet
direct in `public_html` staan, niet in een submap. Verwijder vooraf de
standaardbestanden van Vimexx (`index.html`, `logo.png`). Zet daarna in
DirectAdmin bij **SSL-certificaten** Let's Encrypt aan en, zodra dat werkt,
**Forceer SSL**.

## Automatisch publiceren via GitHub

Na deze inrichting staat elke wijziging op `main` (uit Stacki, het CMS of een
commit) na ongeveer een minuut live. Je hoeft dan geen zip meer te uploaden. De
deploy publiceert alleen vanaf `main` en alleen als alle instellingen kloppen.

### 1. SSH aanzetten in Vimexx

Open DirectAdmin van het pakket met `geluksvogel.bio` en noteer drie gegevens.
Ze staan in de welkomstmail van het pakket en in DirectAdmin:

* de server, bijvoorbeeld `web0123.zxcs.nl`;
* de gebruikersnaam, bijvoorbeeld `u12345p67890`;
* de SSH-poort, bij Vimexx `7685`.

Zet SSH-toegang aan voor het pakket (DirectAdmin → **SSH Keys** of via Vimexx
support).

### 2. Een deploysleutel maken (Terminal op je Mac)

```bash
ssh-keygen -t ed25519 -N "" -C github-actions-geluksvogel -f ~/.ssh/geluksvogel_deploy
pbcopy < ~/.ssh/geluksvogel_deploy.pub
```

Het tweede commando zet de **publieke** sleutel op je klembord. Plak die in
DirectAdmin → **SSH Keys** als één regel, zonder enter erin. Deel de privésleutel
(het bestand zonder `.pub`) nooit in een chat of mail.

### 3. GitHub-instellingen

Ga in GitHub naar `m7branding/geluksvogel` → **Settings → Secrets and variables →
Actions**.

Onder **Secrets**:

| Naam | Waarde |
| --- | --- |
| `VIMEXX_SSH_PRIVATE_KEY` | `pbcopy < ~/.ssh/geluksvogel_deploy` in Terminal, en dan plakken |
| `VIMEXX_SSH_KNOWN_HOSTS` | de serversleutel uit stap 4 |

Onder **Variables**:

| Naam | Waarde |
| --- | --- |
| `VIMEXX_SSH_HOST` | de server, bijvoorbeeld `web0123.zxcs.nl` |
| `VIMEXX_SSH_USER` | de gebruikersnaam, bijvoorbeeld `u12345p67890` |
| `VIMEXX_SSH_PORT` | `7685` |
| `VIMEXX_WEBROOT` | `/home/<gebruikersnaam>/domains/geluksvogel.bio/public_html` |

### 4. De controleknop

Ga in GitHub naar **Actions → Check GeluksVogel go-live readiness → Run
workflow**. Zet de eerste keer het vinkje **show_server_key** aan. De run
uploadt niets. Hij toont een tabel met ✅, ⚠️ en ❌ voor de instellingen, DNS,
het certificaat en de SSH-toegang.

Met het vinkje aan staat in de log onder *Read the SSH server key* één regel die
begint met `[web0123.zxcs.nl]:7685 ssh-ed25519`. Zet die regel in het secret
`VIMEXX_SSH_KNOWN_HOSTS` en draai de controle opnieuw, nu zonder vinkje. Herhaal
tot er bij SSH een ✅ staat.

### 5. Aanzetten

Zet de variabele `VIMEXX_DEPLOY_ENABLED` op `true`. Vanaf nu publiceert elke
push naar `main`. Je kunt ook direct publiceren via **Actions → Build and deploy
GeluksVogel → Run workflow** op `main`.

Bij elke publicatie gebeurt het volgende:

* de deploy bewaart de vorige versie van `public_html` in
  `domains/geluksvogel.bio/geluksvogel-deploy/backups`;
* `public_html` wordt daarna gelijk aan de build. Losse bestanden die je er met
  de hand in zette, verdwijnen dus. Uitzonderingen zijn `.well-known`,
  `cgi-bin` en oude bestanden in `assets/` en `_astro/`: die blijven staan voor
  bezoekers die nog een oudere pagina open hebben;
* de laatste stap vergelijkt elke pagina op het live adres met de build, zodra
  de DNS naar Vimexx wijst.

### 6. HTTPS-doorverwijzing

Werken `https://geluksvogel.bio` en `https://www.geluksvogel.bio` met een geldig
certificaat? Zet dan `VIMEXX_FORCE_HTTPS_REDIRECT` op `true`. Daarna stuurt
`.htaccess` http door naar https, en `www.` naar het kale adres.

### Andere hosting

Het deployscript accepteert alleen een Vimexx-host (`web<nummer>.zxcs.nl`), een
gebruiker als `u12345p67890` en de documentroot
`/domains/geluksvogel.bio/public_html` (of dezelfde map onder
`/home/<gebruiker>`). Releases en back-ups komen in
`/domains/geluksvogel.bio/geluksvogel-deploy`, buiten `public_html`. Komt de
site elders, pas dan de controles in `scripts/deploy-staging.sh` en
`scripts/activate-staging.sh` aan.

## Wat de server meekrijgt

`npm run build:staging` (`scripts/prepare-staging.mjs`) voegt aan `dist/` toe:

* `.htaccess` met 301-doorverwijzingen voor oude WordPress-adressen, **410 Gone**
  voor de spampagina's van de hack, `404.html` als foutpagina, en cacheregels
  voor afbeeldingen en lettertypen.
* `robots.txt` en `sitemap.xml` met alle pagina's (of een dichte `robots.txt` met `DEPLOY_TARGET=staging`).
* `deployment.json` met commit en bouwtijd.
* `admin/`: een melding *Beheer is nog niet beschikbaar*, tenzij
  `DECAPBRIDGE_SITE_ID` is ingesteld (zie hieronder). Het lokale CMS gaat nooit
  mee naar de server.

## Online CMS (optioneel)

Lokaal beheer werkt meteen (zie de README). Wil de klant online teksten
aanpassen, dan gaat dat zoals bij JALO via [DecapBridge](https://decapbridge.com).
Maak daar een site voor `m7branding/geluksvogel` aan en zet het site-ID in de
variabele `DECAPBRIDGE_SITE_ID`. De build schrijft dan een
`admin/config.yml` die rechtstreeks naar `main` commit. Elke wijziging start de
workflow en staat na ongeveer een minuut live.
