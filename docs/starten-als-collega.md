# GeluksVogel openen als nieuwe collega

Met deze handleiding haal je de bestaande GeluksVogel-website uit GitHub, laat je
Codex of Claude Code de benodigde software installeren en open je de site in
Stacki. Je hoeft Stacki en Astro vooraf nog niet te kennen of te installeren.

Repository: [m7branding/geluksvogel](https://github.com/m7branding/geluksvogel).
Handleiding overgenomen van het JALO-project, oktober 2026. De lokale werkwijze is
getest op macOS; de Windows-aanwijzingen zijn nog niet op een nieuwe
Windows-computer doorlopen.

## 1. Regel je accounts

Gebruik je **eigen GitHub-account**. Vraag de beheerder van `m7branding/geluksvogel`
om schrijfrechten en accepteer de uitnodiging. Alleen kunnen openen op
GitHub betekent nog niet dat je wijzigingen mag pushen.

Gebruik daarnaast een account met toegang tot **Codex óf Claude Code**.
Je hoeft ze niet allebei te installeren. GitHub en je AI-account zijn twee
afzonderlijke aanmeldingen.

## 2. Installeer één AI-app en open een lokale map

**Met Codex:** volg de [officiële OpenAI-startinstructies](https://learn.chatgpt.com/docs/quickstart)
om de desktopapp te installeren en in te loggen. De huidige instructies noemen
de ChatGPT-desktopapp; kies daarin **Codex** voor softwareontwikkeling.
Voeg een lokale projectmap toe en begin daar een taak.

**Met Claude Code:** installeer de app via de
[officiële desktopinstructies](https://code.claude.com/docs/en/desktop-quickstart),
log in en kies **Code → Local → Select folder**. Claude Code zit al in deze
desktopapp; een aparte CLI-installatie is hiervoor niet nodig. Volgens de
officiële documentatie is een Pro-, Max-, Team- of Enterprise-abonnement nodig.
Op Windows moet Git aanwezig zijn voordat een lokale sessie kan starten.

Maak bijvoorbeeld met Finder of Verkenner een lege map:

| Computer | Voorbeeldmap |
| --- | --- |
| Mac | `~/Documents/Projecten/geluksvogel` |
| Windows | `%USERPROFILE%\Documents\Projecten\geluksvogel` |

Open deze map in de gekozen AI-app. Als je de repository al hebt **gecloned**,
open je die bestaande map. Een ZIP-download bevat geen Git-geschiedenis of
remote; laat de AI daarom een clone maken.

Kies een **lokale sessie** die direct in deze map werkt. De bestanden moeten
straks dezelfde zijn als in Stacki. Laat de installatieprompt het werkpad
controleren als de app een aparte worktree voorstelt.

Ontbreekt Git en kun je de sessie daardoor niet starten? Installeer het eerst
via de [officiële Git-installatiepagina](https://git-scm.com/downloads/).
Op Windows gebruik je Git for Windows, inclusief Git Bash.

## 3. Plak de installatieprompt

Open **[de volledige installatieprompt](setup-prompt.txt)** en kopieer alle
tekst naar Codex of Claude Code. Op GitHub kun je hiervoor **Raw** openen.
De prompt werkt zelfstandig, ook voordat GeluksVogel is gedownload.

De AI controleert en installeert:

| Onderdeel | Waarvoor het nodig is |
| --- | --- |
| Git | Versiegeschiedenis en ophalen/versturen van wijzigingen |
| GitHub CLI (`gh`) | Aanmelden bij GitHub en toegang controleren |
| Node.js en npm | Astro en Stacki lokaal uitvoeren |
| GeluksVogel-repository | De website, inhoud, afbeeldingen en projectconfiguratie |
| Stacki | De visuele editor, apart van de website geïnstalleerd |

Astro wordt automatisch met de website geïnstalleerd. De prompt gebruikt
Node 22 LTS, minimaal 22.12, overeenkomstig onze CI. Andere ondersteunde
Node-versies die aan de projecteisen voldoen kunnen ook werken.
[Node.js downloaden](https://nodejs.org/en/download).

Rond zelf de browserlogin bij GitHub af en eventuele systeemdialogen tijdens
de installatie. Laat de AI daarna verdergaan. Bij een ontbrekende commitnaam
of e-mailadres geef je je eigen gegevens op.

De prompt gebruikt Stacki **0.1.23**, vastgezet op dezelfde commit als onze
CI. De installatie staat standaard in `~/Downloads/stacki-main`. Bewaar die
map: de GeluksVogel-launcher gebruikt hem telkens om Stacki te starten. De
[Stacki-broncode en startinstructies](https://github.com/flowtricks/stacki/blob/e5e63d8fc2cae38a69ebb789de1e709c5ca02958/README.md)
beschrijven deze manier van uitvoeren.

## 4. Open GeluksVogel in Stacki

Na de installatie start de AI vanuit de **GeluksVogel-projectmap**:

```bash
npm run stacki
```

Dit haalt de laatste wijzigingen van GitHub `main` op, start de
inhoudssynchronisatie en opent Stacki. Kies **Open Project…** en selecteer
de GeluksVogel-map die de AI noemt: de map met `package.json`, `README.md` en `src`.

Stacki start zelf de websitepreview. Laat de terminal met de launcher open
zolang je bewerkt, zodat wijzigingen uit Stacki naar de juiste
inhoudsbestanden worden gesynchroniseerd.

Je kunt beginnen zodra de homepage en andere pagina's zichtbaar zijn, de
projectcontroles slagen en de AI heeft bevestigd dat de synchronisatie draait.
Voor lokaal werken zijn SSH, hostinggegevens en een online CMS-login niet nodig.

## Iedere volgende werkdag

1. Open dezelfde GeluksVogel-map in Codex of Claude Code.
2. Vraag: **“Start dit project in Stacki met de CMS-synchronisatie. Controleer
   eerst de branch en eventuele lokale wijzigingen.”**
3. Open in Stacki opnieuw diezelfde projectmap.
4. Bewerk de site. Laat een AI en Stacki niet tegelijk hetzelfde onderdeel
   veranderen: rond de ene bewerking af voordat je de andere begint.

Je kunt ook zelf een terminal in de GeluksVogel-map openen en `npm run stacki`
uitvoeren. Na wijzigingen aan dependencies kan opnieuw `npm ci` nodig zijn.

Deze eenvoudige startroute gebruikt **main**. De huidige launcher haalt
namelijk altijd `origin/main` op. Spreek bij samenwerken af wie wanneer
wijzigingen deelt. Voor gelijktijdig werk op aparte branches kan de AI een
branchwerkwijze inrichten met een passende pull en een aparte sync-watcher;
gebruik de huidige launcher daar niet blind voor.

## Opslaan, committen en pushen

| Handeling | Wat gebeurt er? |
| --- | --- |
| Bewerken in Stacki | Stacki slaat wijzigingen automatisch lokaal op. |
| Commit | Je legt een versie vast in de Git-geschiedenis op je computer. |
| Push | Je verstuurt je lokale commits naar GitHub, zodat collega's ze kunnen ophalen. |
| Pull | Je haalt commits van collega's naar je eigen computer. |

Stacki ondersteunt automatisch opslaan en commit/push via het branchmenu
in de titelbalk. [Stacki-documentatie](https://github.com/flowtricks/stacki/blob/e5e63d8fc2cae38a69ebb789de1e709c5ca02958/README.md).

Controleer voor een commit de preview en de wijzigingen. Je kunt de AI vragen:

```text
Controleer mijn GeluksVogel-wijzigingen en de CMS-synchronisatie. Voer de relevante
projectcontroles uit en laat weten of er fouten zijn. Als alles klopt,
commit mijn wijzigingen met een duidelijke omschrijving en push naar de
bijbehorende GitHub-branch. Controleer daarna de GitHub Actions-uitkomst.
```

Of gebruik na controle **Commit** en **Push** in Stacki. GeluksVogel bestaat al op
GitHub; de functie om een nieuwe repository te publiceren is niet nodig.

Pushen zet de broncode op GitHub en start de buildcontroles. Zodra de
SSH-aansluiting is afgerond en `VIMEXX_DEPLOY_ENABLED=true` staat, publiceert
een push naar `main` ook naar `geluksvogel.bio`. Zie
[live-zetten.md](live-zetten.md) voor de aansluiting op de hosting.

## Iets gewijzigd dat je niet wilt bewaren?

**Alleen sluiten en opnieuw openen draait wijzigingen niet terug.** Stacki
slaat automatisch op. Voor een zojuist gedane bewerking kun je eerst Undo
proberen. Wil je alle nog niet gecommitte wijzigingen opzijzetten, gebruik
dan deze prompt:

```text
Ik wil mijn nog niet gecommitte GeluksVogel-wijzigingen opzijzetten en terug naar
de laatste lokale commit. Controleer eerst git status en de verschillen.
Laat mij Stacki sluiten en stop de bijbehorende sync-watcher voordat je
bestanden herstelt. Bewaar alle niet-gecommitte wijzigingen, inclusief
nieuwe bestanden, in een benoemde Git-stash. Controleer dat die back-up
bestaat en dat de werkmap weer schoon is. Verwijder de back-up niet.
Voer geen pull of push uit. Vertel welke commit nu actief is en hoe ik de
back-up later kan bekijken of terughalen. Als er een mergeconflict speelt,
of de fout al gecommit is, meld dat eerst en bepaal met mij het herstelpunt.
```

De laatste lokale commit kan afwijken van wat op GitHub staat. Als je terug
wilt naar een specifieke eerdere versie, noem dat expliciet. Deel je die
geschiedenis al met collega's, laat de AI dan een herstelcommit maken.

## Optioneel: het lokale CMS

Voor tekstbeheer via formulieren kun je Decap gebruiken. Sluit voor deze
route Stacki en zijn launcher. Open twee terminals in de GeluksVogel-map:

**Terminal 1 — website:**

```bash
npm run dev
```

**Terminal 2 — lokaal CMS:**

```bash
npm run cms:local
```

Open `http://localhost:4321/admin/` en kies de lokale login. Gebruikt Astro
een andere poort, gebruik dan het adres uit terminal 1 met `/admin/` erachter.
Beide processen moeten blijven draaien. Het CMS schrijft in jouw lokale
projectmap; ook deze wijzigingen deel je daarna via commit en push.

Dit is de lokale beheeromgeving. Een online CMS met klantaccounts volgt bij
het aansluiten van de hosting.

## Als iets niet werkt

| Melding of probleem | Volgende stap |
| --- | --- |
| `git`, `node`, `npm` of `gh` niet gevonden | Laat de AI de installatie en PATH controleren. Herstart na installatie de terminal en zo nodig de AI-app. |
| `package.json` niet gevonden | De terminal staat niet in de GeluksVogel-map. Laat de AI het volledige werkpad controleren. |
| `Stacki not found` | Controleer `~/Downloads/stacki-main`; bij een andere locatie gebruikt de AI `STACKI_SRC` voor launcher en controle. |
| Windows kan `bash` niet vinden | Gebruik Git Bash uit Git for Windows en controleer dat de launcher die Bash gebruikt. Deze Windows-route is nog niet volledig getest. |
| Push geweigerd | Laat de AI het actieve GitHub-account, schrijfrechten en eventuele branchregels controleren. |
| Pull of push meldt conflicten | Laat de AI de verschillen bekijken en samenvoegen; geef aan welke inhoud behouden moet blijven. |
| Stacki toont oude inhoud | Controleer of Stacki en de AI werkelijk dezelfde projectmap hebben geopend. |

De GitHub-login in de prompt gebruikt de officiële
[browserlogin van GitHub CLI](https://cli.github.com/manual/gh_auth_login).
Met [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git)
kan ook Git, en daarmee Stacki, die aanmelding gebruiken.
