# Purust — JSON Decoding : spécialisation et résultats natifs

Plan du 30 septembre 2026. Périmètre : **JsonDecoding**. JsonTypedAst est différé.
Objectif : rejoindre puis dépasser le **Go optimisé publié**, et poursuivre vers
le C. La référence C est du C++ avec simdjson et des structures possédant leurs
chaînes, vecteurs et optionnels.

## Résultats établis

Les ports sont publiés sous `0x000000000000000000001`. Les plans natifs,
`Record_a` sparse, les clés partagées, les accesseurs natifs et le parser sur
octets sont livrés. Le nouveau jalon qualifié est **1 372,79 µs** combined,
contre **6 817,98 µs** pour la cellule précédente.

La nouvelle baseline est reconstruite depuis les drivers canoniques :
`.purs` → `spago build` → purust → Cargo release, codes de sortie vérifiés.
Workspace : `altbak.pub/var/benchmark/json-native-20260930/`.

**Campagne finale qualifiée**, GOMAXPROCS=1/GOGC=100, mêmes binaires Go/C
publiés, six permutations et médiane des minima :

| phase | Rust baseline | Rust natif | Go publié réexécuté | C réexécuté |
|---|---:|---:|---:|---:|
| parse | 1 895,417 | 1 843,125 | 2 219,375 | 391,667 |
| decode | 3 970,083 | **779,271** | 794,396 | 286,730 |
| combined | 6 290,250 | **1 372,791** | 2 518,500 | 686,625 |

Combined : **4,58×** plus rapide que la baseline reconstruite, **−45,5 %**
face au Go optimisé publié et encore **2,00×** le C. Campagne officielle
indépendante : Rust 1 400,459 µs, JS 9 104,375 µs, Go reconstruit 11 811,041 µs,
C 672,375 µs. Le Go reconstruit ne sert pas de référence de gain.

Première campagne DOM exploratoire, µs (médiane des six minima) :

| phase | Rust baseline | Rust spécialisé DOM | Go publié | C |
|---|---:|---:|---:|---:|
| parse | 1 897,396 | 1 885,938 | 1 980,125 | 390,583 |
| decode | 3 944,396 | **873,146** | 687,563 | 285,896 |
| combined | 6 203,979 | **3 102,417** | 2 163,938 | 678,125 |

Première campagne exploratoire texte validé→résultat, mêmes binaires de référence :

| phase | Rust baseline | Rust spécialisé texte | Go publié | C |
|---|---:|---:|---:|---:|
| parse | 1 938,875 | 1 971,312 | 2 036,271 | 399,708 |
| decode | 4 125,979 | **930,771** | 704,563 | 303,146 |
| combined | 6 442,438 | **1 774,146** | 2 261,125 | 682,792 |

Ces deux prototypes ont les 17 empreintes exactes. Le test TAST des schémas
passe en modes ordinaire, spécialisé et threaded ; il couvre les décodeurs
custom, les erreurs, les doublons, les champs ignorés, les limites numériques,
les 65 536 unités UTF-16 et les entrées profondes. La qualification est verte ;
voir la campagne finale ci-dessus pour la cellule publiée.

**Écart de protocole découvert après ces essais :** le script appairé héritait
de GOMAXPROCS=14 au lieu du 1 publié. Ces chiffres sont donc exploratoires.
`paired.py` impose désormais GOMAXPROCS=1/GOGC=100 et vérifie le nombre de
samples et leurs minima. La campagne finale ci-dessus utilise ce protocole
corrigé ; les premiers tableaux sont conservés comme historique exploratoire.

## Architecture en cours

### 1. Spécialisation sur le DOM — implémentée et qualifiée

- `Purust.DecoderSchemas` reconnaît les dictionnaires **effectifs** et leurs
  opérations ; les types seuls ne constituent jamais une preuve de décodage.
- Évaluation symbolique bornée du corps custom : lectures, branches, closures
  de `bind`/`apply`, constructeurs. Le décodeur **Event** est couvert.
- Fonctions Rust générées, résultat interne `Option<Value>` par valeur et un
  seul `Either` public. Tout échec revient à la composition originale pour
  préserver exactement les erreurs et les récupérations.
- `NativeField` est vérifié avec `DecodeJsonField` ; les callbacks opaques
  restent sur leur chemin ordinaire. Handshake de port `schemaDecoderABI2`.
- `--no-json-schemas` permet une comparaison fonctionnelle avec le chemin
  ordinaire. Pas de spécialisation écrite à la main pour le benchmark.
- Les curseurs de champs sont déplacés à leur dernière lecture ; les arguments
  primitifs des constructeurs sont passés typés par valeur. Le test inclut les
  lectures répétées d'un même champ pour vérifier ce transfert.

### 2. Représentations natives intégrées — prototype de records implémenté

- Records concrets, puis tableaux/ADT selon les usages démontrés ; conserver
  l'ABI polymorphe `UnknownType` utilisée par `drive`.
- Adapter ensemble construction, projections, parcours, mise à jour immuable
  et interopérabilité. Le résultat doit être complet et posséder ses données
  avant la fin du chronométrage.
- Comparer aussi les consommateurs PureScript et les conversions nécessaires.
  Une représentation privée inutilisable à travers l'ABI ne constitue pas un
  gain qualifié. Aucun facteur de gain de cette étape n'est présumé.
- Le premier prototype émet des structs Rust à champs primitifs concrets,
  transportés par `Value::NativeRecord`. Les tableaux, optionnels et ADT
  contenus gardent leurs résultats ordinaires, construits immédiatement.
- Getters, projections scalaires empruntées, mises à jour immuables, réflexion
  et conversion `Foreign.Object` sont intégrés. Aucun cache de matérialisation
  différée. `--no-json-layouts` permet la comparaison ; `bench/consume-json.py`
  mesure séparément le décodage avec le consommateur PureScript complet dans
  la fenêtre chronométrée.
- Mesure incluant ce consommateur (isolée avant le transfert final des arguments) :
  combined **18 019,833 → 17 195,167 µs** ; decode **17 433,042 → 16 720,063 µs**.
  Le gain ne disparaît donc pas lorsque le consommateur est chronométré.

### 3. Texte validé→résultat — premier prototype implémenté

- Index compact d'offsets, sans DOM générique ; les mêmes workers travaillent
  sur un curseur DOM ou texte. Les chaînes du résultat sont possédées.
- Validation de **tout** le document, même des champs ignorés ; dernière clé
  dupliquée gagnante après décodage des escapes, ordre arbitraire des champs.
- Encodage UTF-16 interne conservé, y compris les surrogates isolés ; nombres
  IEEE-754 identiques au parser ordinaire. Repli pour les erreurs et la grande
  profondeur ; pas de nouvelle limite de validité imposée au programme.
- Les schémas laissant échapper un sous-arbre Json gardent le chemin DOM.

### 4. Scanner — premier jalon qualifié

- Séparer validation lexicale des nombres et conversion effectivement utile.
- Optimiser les recherches de clés et le balayage des chaînes, puis vectoriser
  les boucles réellement coûteuses. Chaque variante doit conserver l'oracle
  et les cas sensibles du parser.
- Prototype : séparation lexique/conversion numérique ; balayage de huit
  octets par mot (SWAR), chargé sans accès hors limites, partagé avec le parser
  DOM. Test de chaque octet dans chaque position et chaque queue, plus
  différentiels de documents tronqués et de nombres longs.

## Protocole de mesure et de livraison

1. `npm run build`, puis `bench/build-json.py` : manifestes, empreintes des
   entrées, snapshots des binaires. Ne jamais réutiliser un binaire après un
   échec de compilation.
2. `bench/paired.py` : baseline/candidat + **binaires Go/C publiés préservés**,
   six permutations de `DIAG_PHASES`, deux échauffements et cinq échantillons
   par processus, médiane des six minima. Le Go reconstruit par le harnais est
   distinct et ne remplace pas cette référence.
3. Empreintes exactes Rust/Go ; côté C, empreintes des succès exactes et rejet
   des erreurs, suivant le contrat du harnais officiel.
4. Tests codegen/TAST, contrats d'allocation et d'identité conservés, puis
   `bin/b --runtime rust -c && bin/t --runtime rust -c` dans b8x.
5. Campagne officielle, documentation, commits et push des dépôts concernés.
   Publier uniquement les résultats qualifiés.

Parse/decode/combined et lifecycle sont des mesures distinctes. Combined
n'est pas la somme d'un budget parse et d'un budget decode lorsque le chemin
texte est spécialisé.

## Expériences antérieures et limites des conclusions

- CAF `edge-caf` (`29a809f`) : régression mesurée, plusieurs tests TAST rouges,
  dont `known-nullaries` à 7 allocations au lieu de 1. Non fusionné. Cela ne
  démontre pas que tout partage est inutile ni la cause précise de la régression.
- Chaînes partagées `edge-rcstr` (`add4679`) : 6 832,292 µs combined, oracle
  exact ; ports remis à leur état initial, qualification b8x non effectuée.
  Non fusionné.
- Le décompte ancien de 135 052 allocations (dont ≈133 054 petites) et les
  compteurs régionaux ne donnent **pas** leur attribution propre : les régions
  sont imbriquées. Les essais historiques à sortie de compilation masquée ne
  permettent pas de conclure à l'absence de gain d'une transformation.
- Le profilage par backtraces s'est bloqué sans fournir de piles exploitables.
  La cause n'est pas établie ; examiner notamment la réentrance de `OnceLock`
  avant la garde de l'allocateur. Aucune attribution aux closures ou boxages
  n'est tenue pour prouvée.
- `SharedRecord` conserve `Mutex` : le remplacement global par `RefCell` était
  incompatible avec threaded/Arc. Le worker DOM groupe ses lectures sous un
  verrou qu'il libère avant de descendre dans les enfants.
- Le cache de matérialisation par site reste non implémenté ; ce n'est plus la
  première piste de ce chantier.

## Suivi de qualification

- [x] Baseline propre et binaires préservés.
- [x] Scripts de mesure : validation C rétablie, hashes des binaires conservés.
- [x] Workers DOM pour Payload et Event.
- [x] Chemin texte complet, oracle exact, test schémas Rc/Arc.
- [x] Codegen après première spécialisation texte : succès.
- [x] Premier TAST complet : 43/43 ; dépendances js-bigints résolues.
- [x] Prototype de record natif intégré, tests différentiels des consommateurs
      dans quatre modes (ordinaire, spécialisé boxé, records natifs, threaded).
- [x] Validation b8x du runtime de records natifs : 286/286, exit 0.
- [x] Mesure des consommateurs ; TAST après scanner : 43/43.
- [x] Après transfert des arguments : codegen 81/81 et fixture schémas dans
      les quatre modes, plus tests du scanner Rc/Arc.
- [x] Campagne officielle et campagne appairée avec GOMAXPROCS=1.
- [x] Commits/push des ports et du compilateur ; publication du jalon qualifié
      dans `altbak.pub/docs/benchmark-results/2026-09-30-rust-json-native.md`.

## Prochain jalon vers le C

Le jalon Go est franchi pour combined. Restent les représentations concrètes
des éléments de tableaux et des ADT paramétrés, intégrées à `UnknownType` et
aux consommateurs, puis une vectorisation plus large du scanner si les mesures
la justifient. Préserver exactement les contrats ci-dessus ; ne pas annoncer
un facteur de gain avant une mesure appairée qualifiée.
