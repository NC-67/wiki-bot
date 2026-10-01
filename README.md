# WikiMasters Pack Hunter

Extension Chrome (Manifest V3), version 2.10.0. Elle prépare une fenêtre privée, inscrit un compte WikiMasters avec une adresse [10minutemail](https://10minutemail.com/), passe le gate `/pull`, ouvre les packs sur `/pulls` et enregistre chaque carte.

Le comportement d'automatisation est celui de la 2.9.2. La 2.10.0 change la structure du code, la documentation et l'endroit où le popup lit les comptes.

## Installation

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée** et sélectionner ce dossier (`wiki-bot`, celui qui contient `manifest.json`).
4. Dans les détails de l'extension, autoriser la navigation privée. L'extension est en mode `spanning` : la même copie tourne dans les fenêtres normales et privées.

Ouvrir une fenêtre privée. L'extension y place 10minutemail et `https://www.wiki-masters.com/signup`.

## Fonctionnement

1. L'adresse temporaire est lue et envoyée à l'onglet d'inscription de la même fenêtre.
2. Le nom d'utilisateur est la partie locale de l'adresse. Le mot de passe est l'adresse complète.
3. Le code reçu par mail est déposé dans le champ OTP.
4. Sur `/pull`, le gate « Je ne suis pas un robot » bloque l'ouverture des packs tant que **Continuer** n'a pas été cliqué. Si `autoStartupGate` est actif, l'extension coche et valide toute seule.
5. Sur `/pulls`, les packs s'ouvrent tout seuls. Chaque pack est enregistré avec ses cartes (`name`, `rarity`, `imgAlt`). La rareté `L` est le seul marqueur d'une légendaire. L'ouverture ne s'arrête pas sur une légendaire.

Si l'inscription est refusée parce que le nom est déjà pris, ou si elle expire (`timeout`), la boîte mail tourne et le formulaire est rempli à nouveau.

## Architecture

Trois contextes Chrome, plus un dossier partagé. Aucun bundler : le service worker et les scripts de contenu sont des modules ES, chargés par `manifest.json`.

```
manifest.json
src/
  shared/                 constantes, URLs, réglages, comptes
    constants.js          hôtes, clés de stockage, messages, timers
    settings.js           lecture / écriture de wmph_settings
    storage.js            comptes, packs, export JSON et CSV
    url.js                filtres wiki-masters et 10minutemail
    util.js               sleep, normalize
  background/             service worker
    index.js              point d'entrée
    incognito.js          fenêtres privées, onglets mail et inscription
    router.js             messages entre le mail et WikiMasters
  content/wiki/           pages wiki-masters.com
    index.js              démarrage de l'onglet
    session.js            état mutable de l'onglet
    pages.js              /signup, /pull, /pulls
    dom.js                boutons, gate, cartes visibles
    overlay.js            pastille en bas à droite
    runtime.js            timers et réglages de l'onglet
    signup.js             formulaire, OTP, résultat
    gate.js               captcha /pull
    packs.js              ouverture et lecture des cartes
    navigation.js         changements d'URL
    messages.js           commandes reçues par l'onglet
  content/mail/           10minutemail.com
    index.js              adresse, code, rotation
  popup/                  icône de la barre d'outils
    popup.html
    popup.css
    popup.js
```

`src/shared` ne touche pas au DOM. Le service worker ne clique pas dans les pages : il ouvre les onglets et relaie les messages. Le script wiki est le seul à remplir le formulaire, valider le gate et ouvrir les packs. Le script mail est le seul à lire 10minutemail. Le popup affiche l'état de l'onglet actif et lit les comptes dans `chrome.storage`, même si l'onglet actif n'est pas WikiMasters.

Les modules wiki qui doivent s'appeler entre eux passent par `session` (données) et `api` (fonctions enregistrées au chargement). Ça évite les imports circulaires entre le gate, les packs et l'overlay.

### Messages

| Type | Direction | Rôle |
| --- | --- | --- |
| `wmph` | popup ou service worker → onglet wiki | `fillSignup`, `fillOtp`, `retrySignup`, `getState`, `toggle` |
| `wmph_email_address` | mail → service worker → `/signup` | nouvelle adresse |
| `wmph_email_code` | mail → service worker → onglets wiki | code à 6–12 chiffres |
| `wmph_email_rotate` | service worker → onglet mail | demander une nouvelle adresse |
| `wmph_signup_result` | onglet wiki → service worker | succès, ou rotation si le nom est pris ou si le délai est dépassé |

Le relais d'adresse et de code reste dans la fenêtre d'où vient le message.

### Stockage

Tout est dans `chrome.storage.local`.

| Clé | Contenu |
| --- | --- |
| `wmph_settings` | timers et cases `autoSignup`, `autoStartupGate` |
| `wmph_accounts` | un objet par adresse |
| `wmph_current_email` | adresse en cours dans l'onglet |

Un compte contient `email`, `username`, `password`, `createdAt`, `signupStatus` (`pending`, `success`, `failed`), `failureReason`, `packs`, `totalPacks`, `lastUpdated`.

### Garde-fou captcha

- `sawPullGate` devient vrai dès qu'une page `/pull` est vue.
- `captchaConfirmed` devient vrai seulement après un clic effectif sur **Continuer**.
- `runLoop()` ne tourne pas tant que `sawPullGate && !captchaConfirmed`.
- L'overlay affiche « Captcha non validé - attente ».

### Export

Dans le popup : **Comptes**, puis **Exporter JSON** ou **Exporter CSV**. L'export ne dépend plus de l'onglet wiki ouvert.

Le JSON a la forme `accounts[email].packs[].cards[]` avec `name`, `rarity`, `imgAlt`.

Le CSV a une ligne par carte :

`email`, `username`, `password`, `createdAt`, `signupStatus`, `failureReason`, `totalPacks`, `lastUpdated`, `packId`, `packOpenedAt`, `packClosedAt`, `packCardCount`, `cardIndex`, `cardName`, `cardRarity`, `cardImgAlt`.

## Contributeurs

- [buryu](https://github.com/buryusu) — auteur du dépôt, jusqu'à la 2.9.2.

Détail : [CONTRIBUTORS.md](CONTRIBUTORS.md).

## Historique

Le détail des versions est dans [CHANGELOG.md](CHANGELOG.md).
