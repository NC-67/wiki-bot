# WikiMasters Pack Hunter 3.0.2

Extension Chrome MV3. Inscription auto, rotation mailbox, tracking comptes + cartes.

## Installation
1. `chrome://extensions/` -> Mode developpeur -> Charger l'extension non empaquetee.
2. Selectionner le dossier `WikiMasters-PackHunter/`.
3. Details -> Autoriser en navigation privee.

## Flux
1. Fenetre privee ouverte -> l'extension ouvre 10minutemail + wiki-masters/signup.
2. Inscription auto (username = local-part, password = email complet).
3. OTP recupere et rempli -> redirection /pull.
4. Gate captcha detecte. L'ouverture des packs est bloquee tant que
   le captcha n'est pas confirme. Auto si `autoStartupGate` active,
   sinon clic manuel sur « Continuer ».
5. Redirection /pulls -> ouverture automatique des packs.
   Chaque pack enregistre avec ses cartes (nom + rarete).
   Une carte legendaire est identifiee par `rarity: "L"` uniquement.

## Export
Popup -> Comptes -> Exporter JSON/CSV.

JSON : `accounts[email].packs[].cards[]` contient
`name`, `rarity`, `imgAlt`.

CSV : une ligne par carte, colonnes :
`email, username, password, createdAt, signupStatus, failureReason,
totalPacks, lastUpdated,
packId, packOpenedAt, packClosedAt, packCardCount,
cardIndex, cardName, cardRarity, cardImgAlt`.

## Comptes importés et changement de compte

Dans le popup, section **Comptes prédéfinis**, clique sur **Charger un fichier de comptes**.

```json
[
  {"email":"compte1@example.com","password":"mot-de-passe-1"},
  {"email":"compte2@example.com","password":"mot-de-passe-2"}
]
```

Les exports JSON contenant un objet `accounts` sont aussi acceptés. Clique sur un compte, ou sur Précédent/Suivant, pour lancer le changement. Active **Changement de compte automatique** pour passer au compte suivant après avoir ouvert tous les packs disponibles. L’extension attend la fermeture du dernier pack, puis confirme qu’aucun bouton « Ouvrir » ne revient avant de changer de compte.

## Garde-fou captcha
- `sawPullGate` : true des qu'une page /pull est vue.
- `captchaConfirmed` : true seulement apres clic effectif sur « Continuer ».
- `runLoop()` refuse de tourner tant que `sawPullGate && !captchaConfirmed`.
- Overlay affiche « Captcha non valide - attente ».

## Changelog 2.9.2
- Arret sur legendarie supprime : les packs continuent quelle que soit la rarete.
- `rarity: "L"` est le seul marqueur de legendarie.
- Champs `isLegendary`, `cardIsLegendary`, `packLegendary`, `legendaryCount`
  retires du stockage, des exports JSON et CSV.
