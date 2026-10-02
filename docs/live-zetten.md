# GeluksVogel live zetten

De website moet komen op **https://www.geluksvogel.bio**. Dat adres staat op één
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

## Volgorde

1. **Hosting kiezen.** Het deployscript accepteert alleen een Vimexx-host
   (`web<nummer>.zxcs.nl`), een gebruiker als `u12345p67890` en de documentroot
   `/domains/geluksvogel.bio/public_html` (of dezelfde map onder
   `/home/<gebruiker>`). Releases en back-ups komen in
   `/domains/geluksvogel.bio/geluksvogel-deploy`, buiten `public_html`. Komt de
   site elders, pas dan de controles in `scripts/deploy-staging.sh` en
   `scripts/activate-staging.sh` aan.
2. **Deploysleutel.** Maak een eigen sleutelpaar voor deze site:
   `ssh-keygen -t ed25519 -C github-actions-geluksvogel`. Zet de publieke sleutel
   in DirectAdmin onder **SSH Keys**, zet **SSH access** aan en noteer de poort
   (bij Vimexx meestal `7685`).
3. **GitHub-instellingen**, onder **Settings → Secrets and variables → Actions**:

   | Soort | Naam | Waarde |
   | --- | --- | --- |
   | Secret | `VIMEXX_SSH_PRIVATE_KEY` | de privésleutel uit stap 2 |
   | Secret | `VIMEXX_SSH_KNOWN_HOSTS` | uitvoer van `ssh-keyscan -p 7685 web…zxcs.nl` |
   | Variabele | `VIMEXX_SSH_HOST` | `web…zxcs.nl` |
   | Variabele | `VIMEXX_SSH_USER` | `u…p…` |
   | Variabele | `VIMEXX_SSH_PORT` | `7685` |
   | Variabele | `VIMEXX_WEBROOT` | `/home/<gebruiker>/domains/geluksvogel.bio/public_html` |
   | Variabele | `VIMEXX_DEPLOY_ENABLED` | `true` zodra alles hierboven klopt |

4. **Publiceren.** Merge naar `main`. De deploy bevestigt vanaf de server
   hoeveel bestanden er staan en toont `deployment.json` met de commit.
5. **DNS** van `geluksvogel.bio` en `www.geluksvogel.bio` naar het nieuwe pakket
   laten wijzen, en daarna een **Let's Encrypt-certificaat** uitgeven voor beide
   namen.
6. **Doorsturen aanzetten:** zet `VIMEXX_FORCE_HTTPS_REDIRECT` op `true`, maar
   pas als beide namen over HTTPS werken. Dan stuurt `.htaccess` http naar https
   en `geluksvogel.bio` naar `www.geluksvogel.bio`.
7. **Controle.** Na de DNS-verhuizing vergelijkt de workflowstap *Verify public
   website matches this build* elke pagina op het live adres met de build.

## Wat de server meekrijgt

`npm run build:staging` (`scripts/prepare-staging.mjs`) voegt aan `dist/` toe:

* `.htaccess` met 301-doorverwijzingen voor oude WordPress-adressen, **410 Gone**
  voor de spampagina's van de hack, `404.html` als foutpagina, en cacheregels
  voor afbeeldingen en lettertypen.
* `robots.txt` (open voor zoekmachines, of dicht met `DEPLOY_TARGET=staging`).
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
