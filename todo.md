# Purust — réduire les ratios /C de la table Rust

Plan du 26 septembre 2026. Remplace le plan de couverture des tests
(conservé à l'historique git, dernier état `093559e`).

## Objectif

Améliorer la colonne **Hand-written PureScript → purust** de la table Rust
d'`altbak.pub/README.md` en priorisant les tests dont le ratio au C est le plus
défavorable : **List Processing (371×)**, **Prime Sieve (137×)**, puis
**State Monad** et **Church** (ratio non calculable sur l'affichage arrondi du
C). **RBTree** reste le levier principal du total purust (95,1 %).

Les ratios `/C` comparent des algorithmes différents : le C de List Processing
est une boucle directe et son crible teste la divisibilité jusqu'à √n. Ils
servent d'indicateur de marge, pas de preuve que le backend peut récupérer tout
le facteur. Pour une comparaison de forme équivalente (mêmes structures
fonctionnelles), utiliser les colonnes **Rust FFI** de la même table.

## État mesuré (26/09/2026, Apple M4 Pro, médianes de 3 process)

| Test | purust | C | ratio purust/C | Rust FP FFI | écart vs FP FFI |
|---|---:|---:|---:|---:|---:|
| List Processing | 18,57 µs | 0,05 µs | ≈ 371× | 11,05 µs | 1,68× |
| Prime Sieve | 146,47 µs | 1,07 µs | ≈ 137× | 78,88 µs | 1,86× |
| State Monad | 46,91 µs | ~0 µs | non calculable | 27,36 µs | 1,71× |
| Church Numerals | 169,57 µs | ~0 µs | non calculable | 1 033,78 µs (FP)<br>0,01 µs (impératif) | OCaml 140,38 µs<br>Haskell 143,90 µs |
| RBTree | 8 449,35 µs | 9 788 µs | 0,86× | 28 737,38 µs | purust devant |
| TCO / Records / Ackermann / Array | — | — | 0,90× / 0,96× / 0,96× / 0,80× | — | purust devant le C |

Total purust : **8,88 ms**. RBTree pèse 8 449,35 µs, soit **95,1 % du total** :
−10 % sur RBTree ≈ **−845 µs**, alors que List + Primes + State + Church
réunis pèsent 382 µs.

## Priorité 1 — List Processing (`src/Test/ListOps.purs`)

`sumEvens n = foldl (+) 0 (filterEvens (range 1 n))`. Le Rust généré
(`output/purust_output/Purs_Test_ListOps/src/lib.rs`) montre :

- des nœuds `Rc<List>` dont les éléments restent en `UnknownType`/`Value` ;
- un `foldl` générique appelé par adaptateurs `Func2`/closures ;
- des listes intermédiaires matérialisées entre `range`, `filterEvens` et
  `foldl` ;
- un échafaudage `Thunk`/`Func2::Shared` autour des fonctions récursives
  locales.

Pistes :

- [ ] Spécialiser `filterEvens`/`foldl` sur `List Int` : éléments `i64` non
  boxés, prédicat et addition en appels directs.
- [ ] Fusionner `range` + `filterEvens` + `foldl` en un seul parcours, ordre
  et total préservés, sans matérialiser la liste intermédiaire.
- [ ] Émettre des appels directs pour les fonctions locales connues (éviter
  les adaptateurs `FuncN` et les closures par itération).
- [ ] Éliminer les clones de `Rc` inutiles dans les reconstructions
  (`Cons` construit avec `purs_local_3.clone()` alors que le nœud est local).
- [ ] Vérifier avec le harnais complet : oracle `202950` inchangé, puis mesure
  isolée de la colonne.

## Priorité 2 — Prime Sieve (`src/Test/Primes.purs`)

Le crible enchaîne `filter` + `reverse`, une récursion non terminale et une
somme finale. Le code généré reconstruit massivement des nœuds et clone les
listes partagées (`Rc::unwrap_or_clone`).

Pistes :

- [ ] Réutiliser les cellules consommées quand l'unicité est établie :
  `__purust_take`/`__purust_rebuild_Cons` existent déjà dans le code généré ;
  vérifier et étendre leur émission.
- [ ] Spécialiser les parcours sur `Int` et le prédicat `\x -> x mod p /= 0`
  (capture de `p` résolue une fois par filtre).
- [ ] Fusionner `filter` + `reverse` (le filtre produit l'accumulateur dans le
  bon ordre) et la somme finale.
- [ ] Éviter les clones de nœuds partagés restants dans `sieve`.

Référence intermédiaire : la colonne Rust FP FFI est à 78,88 µs (1,86× plus
vite) avec les mêmes structures.

## Priorité 3 — State Monad (`src/Test/StateMonad.purs`)

Les chaînes `State` sont immédiatement exécutées
(`runManyTimes n acc = ... runState (chainModifications 60) 0`), mais le Rust
généré alloue closures et records `{ val, state }` à chaque bind.

Pistes :

- [ ] Spécialiser `bindState`/`chainModifications` quand la composition est
  connue et immédiatement appliquée (analogue des fusions `FunctionFusion` et
  `ThunkFusion` existantes).
- [ ] Éliminer les records `Record_state_val` intermédiaires et les closures
  par étape ; transmettre l'état directement.
- [ ] Référence de forme équivalente : `StateMonadFFI.rs` (27,36 µs), puis le
  C (~0 µs affiché).

## Priorité 4 — Church Numerals (`src/Test/Church.purs`)

`fromInt` est déjà émis en boucle. Les compositions `mulC`/`c100k` construisent
encore des `Func1/Func2::Shared` et des applications partielles par étape.

Pistes :

- [ ] Spécialiser les compositions `mulC (c10 n) (c10 n)` jusqu'à l'application
  finale quand les fonctions sont privées et connues.
- [ ] Réutiliser les applications partielles préparées hors de la boucle
  (précédent : `PartialBindings` côté phpurs).
- [ ] Objectif réaliste : rester devant OCaml (140,38 µs) et Haskell
  (143,90 µs) tout en réduisant l'écart avec la colonne impérative.

## Levier total — RBTree (`src/Test/RBTree.purs`)

RBTree = 95,1 % du total purust malgré un ratio 0,86× face au C. Même une
petite amélioration relative rapporte plus que toutes les priorités ci-dessus
réunies.

Pistes déjà identifiées dans `optimization-audit.md` :

- [ ] Étendre les permutations de champs au-delà du premier embranchement et à
  d'autres topologies que trois cellules / même direction.
- [ ] Poursuivre l'inspection des coûts de traversée empruntée et d'accès aux
  champs de records.
- [ ] Mesurer par paires alternées sur le runner complet, comme les
  rapports `scratch/rust-*-20260909/REPORT.md`, sans mélanger les campagnes.

## Annexe — anomalies sharpurs → Fable (hors purust)

Colonne 2 de la table Rust (`sharpurs → Fable patché → Rust`, thin LTO) :

| Test | Fable | C | ratio |
|---|---:|---:|---:|
| TCO | 23 547,50 µs | 33,78 µs | ≈ 697× |
| Records | 8 728,98 µs | 3,41 µs | ≈ 2 560× |
| RBTree | 659 207,04 µs | 9 788 µs | ≈ 67× |
| Polymorphism | 1 588 595,46 µs | ~0 µs | 64,7 % du total 2 455,35 ms |

Ces écarts sont apparus avec l'activation de thin LTO (11 lignes s'améliorent
de 7–18 %, trois explosent). Avant d'attribuer la régression à LTO :

- [ ] Reconstruire le même Rust généré avec et sans `lto = "thin"`, sur les
  seuls tests concernés, et comparer les binaires et les temps.
- [ ] Si LTO est confirmé, inspecter l'inlining des fonctions récursives du
  runtime Fable concernées (TCO, arbres, thunks paresseux).
- [ ] Documenter la décision dans `altbak.pub` (profils, SHAs, campagnes).

## Protocole de mesure et clôture

- Build : `python3 tmp/run_purust_benchmark.py --build-only` ; une exécution
  simple de contrôle : `./bin/rust/run`, `./bin/rust/run --run-only`.
- Publication : `python3 tmp/run_purust_benchmark.py --update-readme` (met à
  jour la seule colonne purust et la référence C, jamais les autres).
- Chaque mesure publiée = 3 process indépendants, médiane par ligne ; ne pas
  mélanger des campagnes de profils ou de sources différentes.
- Après chaque transformation : `npm run test:codegen` et
  `PURS=/chemin/vers/tast-purs npm run test:tast` dans `purust/`, plus le
  runner complet des 14 noyaux (oracles validés).
- Une cellule n'est publiée que si la sortie attendue est validée ; les
  hypothèses non mesurées restent listées ici, pas dans le tableau.
