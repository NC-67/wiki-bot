# Changelog

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
