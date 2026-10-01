# Changelog

## [3.0.4] - 2026-10-01
- Import de comptes prédéfinis : prise en charge des listes JSON, des exports JSON contenant `accounts` et des objets indexés par adresse e-mail.
- Documentation du changement manuel et automatique de compte.
- Changement de compte : suppression de la session Supabase locale au lieu de l’ancienne route `/logout` inexistante.
- Changement de compte : suppression des cookies, du stockage local et d’IndexedDB limitée aux domaines WikiMasters.
- Le changement automatique se déclenche uniquement si la page indique explicitement qu’il ne reste aucun pack ; un compteur de packs disponibles ne le déclenche plus.
- Si la page ne fournit pas de texte explicite, le changement s’effectue après la fermeture d’au moins un pack et l’absence stable de bouton « Ouvrir ».

## [2.9.2] - 2026-09-27
- content.js : suppression de l'arret sur legendarie. L'ouverture des packs
  continue quelle que soit la rarete rencontree.
- content.js : la rarete `L` est desormais le seul marqueur d'une carte
  legendaire (fallback sur `.legendary-shimmer-sheen` ou `imgAlt`).
- storage.js : suppression des champs `isLegendary`, `cardIsLegendary`,
  `packLegendary`, `legendaryCount` dans JSON et CSV.
- popup.js : retrait du compteur de legendaires dans le resume comptes.

## [2.9.1] - 2026-09-26
- Export JSON/CSV : nom + rarete de chaque carte par pack et par compte.
- content.js : conservation des doublons de cartes dans un meme pack.
- content.js : garde-fou captcha - blocage de l'ouverture des packs
  tant que le gate /pull n'est pas confirme.

## [2.9.0] - 2026-09-26
- Inscription automatisee, rotation mailbox, gate auto, tracking comptes + cartes.
