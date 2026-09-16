# FBIP via TAST : état au 17 septembre 2026

Objectif conservé : réduire de 50 % le temps de `Test.RBTree` par rapport à
la baseline Rust officielle d'`altbak.pub/README.md`, soit passer de
8 788,42 µs à 4 394,21 µs. **Objectif de performance non atteint.**

## Corrections terminées

- [x] Lire directement `bindingUsage` et `variableUse`, sans marqueur racine.
  Les faits absents restent inconnus ; les identités locales sont validées
  avec leur module et leur portée. `usageCount` et `escapes` ne sont plus lus.
- [x] Documenter leur portée : une dernière occurrence dans le source ne
  prouve ni l'unicité de l'allocation ni la dernière utilisation après PBO.
- [x] Supprimer `UsageMeta`, qui avait bloqué les simplifications PBO. La
  dépendance effective est `htdocs/purescript-backend-optimizer-purust`.
- [x] Invalider les faits source en sortie de monomorphisation et avant
  conversion vers l'IR backend. Conserver les types et `TypeApp`.
- [x] Conserver les décisions clone/move fondées sur la liveness finale
  (`alive`) et les contrôles d'unicité Rc. Les faits source ne les remplacent
  pas ; aucune enveloppe d'usage ne subsiste dans le générateur Rust.
- [x] Ajouter `--trace-phases` pour repérer le module et la phase coûteuse.
- [x] Recompiler le compilateur et le backend, vérifier les régressions et
  compiler/exécuter RBTree dans un workspace isolé avec manifest frais.

Migration du 17 septembre : build Purust réussi, 12 tests de lecture/validation
et 5 tests de recalcul PBO réussis. Génération : 76/80 tests réussis, quatre
tests FFI bloqués par le conteneur de référence arrêté, y compris après
relance avec accès au socket Docker. Les intégrations TAST `record-borrows`
et `rotations` passent. Contrat :
`htdocs/purescript-backend-optimizer-purust/CORE_FN_USAGE.md`.

## Mesures vérifiées

La génération Rust termine en 9,52 s sur les anciens fichiers TAST. L'ancien
bundle instrumenté dépassait le budget de 200 000 appels de génération après
78 s tout en progressant entre modules : la boucle infinie supposée n'est
pas démontrée, mais les wrappers provoquaient une régression d'optimisation.

Cinq séries non instrumentées, chacune avec le protocole officiel (3 warm-ups,
meilleur de 10) : **8 538,08 ; 8 329,88 ; 8 608,62 ; 8 536,29 ; 8 348,96 µs**.
Médiane des cinq résultats : **8 536,29 µs**, proche de la baseline historique.
La sortie attendue, `22`, est validée à chaque série.

Un comptage séparé sur le Rust fraîchement généré établit, pour 100 000 clés :

- **100 001 allocations** : la cellule initiale et un nœud par clé ;
- **2 483 932 succès de `get_mut`, aucun échec** sur le scénario unique ;
- **99 978 rotations sur place** ;
- **2 183 976 clones temporaires de références** pendant la descente ;
- **200 000 clones** pendant le parcours `depth`.

Les invariants rouge/noir, l'ordre des clés, les quatre rotations, les
références faibles, 200 versions conservées et les bilans mémoire sont
vérifiés. Les compteurs ne sont pas utilisés pour mesurer le temps.

## Décisions d'équilibrage intégrées — 16 septembre 2026

- [x] Générer des tests de constructeurs avec champs empruntés, puis partager
  une continuation répétée lorsque sa portée le permet. Rendu générique,
  budget global de 128 décisions et repli vers l'ancien rendu.
- [x] Conserver tous les contrôles Rc : le module RBTree généré garde ses
  103 occurrences de `Rc::get_mut` et ses 652 `.clone()`.
- [x] Vérifier le gain sur le runner complet : deux campagnes de 21 paires,
  **−2,96 % / −4,03 % sur RBTree**, **−2,73 % / −3,65 % sur le total**.
  Les 14 sorties sont validées à chaque passage. L'objectif −50 % reste ouvert.
- [x] Ajouter 1 078 cas de décisions Rc/Arc et vérifier les régressions :
  75 tests réussis, quatre tests FFI bloqués par l'environnement Docker.
- [x] Prouver une autre marge sur Records, dans une copie du Rust généré :
  **376,17 µs → 3,54 µs**, soit environ **−4,04 % sur le total** du runner
  complet en comparaison appariée. Le partage des entrées est conservé.
- [x] Généraliser la variante Records dans le backend : champs primitifs
  gardés dans des variables de boucle, matérialisation du record à la sortie,
  conservation des dépendances entre anciennes/nouvelles valeurs et du COW.
  La passe est intégrée pour les records fermés à feuilles Int ; les types
  nécessaires existent déjà dans le TAST.

Rapports :
`htdocs/altbak.pub-purust/scratch/compact-guards-integration-20260916/REPORT.md`
et `htdocs/altbak.pub-purust/scratch/records-tast-opportunity-20260916/REPORT.md`.
Ces premières expériences précèdent la campagne intégrée ci-dessous.

## Scalarisation Records intégrée — 16 septembre 2026

- [x] Intégrer `RecordScalarization` dans Purust, après PBO : les boucles
  reconnues transportent les champs Int dans des paramètres natifs et
  reconstruisent le record à la sortie. L'ABI publique reste conservée.
- [x] Étendre la passe aux appels locaux purs dont le corps est disponible,
  via `RecordScalarCalls` : un worker Int par champ modifié, dépendances
  calculées sur l'IR final, champs conservés réutilisés.
- [x] Vérifier zéro itération, zéro écriture, mises à jour simultanées et
  conditionnelles, champs constants, partage des anciennes versions,
  entrée unique sans allocation, collisions et replis prudents sous Rc/Arc.
- [x] Recompiler et mesurer le runner complet sur 21 paires : Records
  **394,08 → 3,92 µs (−99,01 %)** ; total **9,06451 → 8,66750 ms**,
  **−4,65 % en comparaison appariée**. Le témoin inclut déjà l'optimisation
  RBTree précédente ; son Rust généré est identique entre les deux variantes.
- [x] Mesurer les appels générés dans un fixture séparé :
  **336,084 → 5,167 µs** avec inlining normal ;
  **349,292 → 21,542 µs (−93,62 %)** en empêchant l'inlining des helpers.
  Les quatre appels scalaires par itération restent visibles en assembleur.
  Ce fixture n'est pas une mesure supplémentaire du runner officiel.
- [x] Vérifier la génération : **76 tests réussis sur 80**, quatre tests FFI
  bloqués par Docker (conteneur de référence arrêté). Les ajouts ciblés
  finaux passent également sous Rc/Arc.
- [x] Évaluer les étapes PBO et Haskell : aucune modification nécessaire
  pour ce périmètre. Les résumés sont calculés dans Purust ; les appels
  opaques ou externes non analysables conservent le chemin existant.

Rapport, protocole, limites et mesures brutes :
`htdocs/altbak.pub-purust/scratch/record-scalarization-integration-20260916/REPORT.md`.
L'objectif initial de −50 % sur RBTree reste non atteint.

## Autres pistes FBIP

- [ ] Mesurer une suppression des clones temporaires de descente, en
  comparant des workers empruntant les enfants aux substitutions actuelles.
  Les clones actuels ne provoquent pas d'allocations supplémentaires.
- [ ] Mesurer un parcours `depth` par emprunt, avec destruction comptabilisée
  de façon identique dans les variantes comparées.
- [ ] Si des preuves statiques plus fortes sont nécessaires, définir des
  contrats par paramètre (emprunt/consommation), provenance du résultat,
  partage des enfants et multiplicité des closures. Recalculer ou invalider
  ces preuves après chaque transformation susceptible de les changer.

Un taux de réemploi déjà égal à 100 % ne peut pas être amélioré par une simple
borne source `bindingUsage.maxUses`. Ne pas remplacer les contrôles dynamiques par une
supposition d'unicité, et ne pas promettre zéro allocation pour la création
de nouvelles clés.

Preuves et commandes :
`htdocs/altbak.pub/scratch/purust-fbip-20260916/REPORT.md`.
