# Purust — JSON Decoding : spécialisation et résultats natifs

Plan du 30 septembre 2026. Périmètre : **JsonDecoding**. JsonTypedAst est différé.
Objectif : rejoindre puis dépasser le **Go optimisé publié**, et poursuivre vers
le C. La référence C est du C++ avec simdjson et des structures possédant leurs
chaînes, vecteurs et optionnels.

## Résultats établis

Les ports sont publiés sous `0x000000000000000000001`. Le jalon courant est
**1 130,69 µs** combined, après **1 372,79 µs**, puis **6 817,98 µs** auparavant.
Il inclut les tableaux natifs, les absences locales partagées, les chaînes
échappées réservées, les transferts de paramètres et les discriminateurs empruntés.

**Campagne finale `owned-v11`**, GOMAXPROCS=1/GOGC=100, six permutations et
médiane des minima, mêmes binaires Go/C publiés :

| phase | Rust précédent réexécuté | Rust courant | Go publié réexécuté | C réexécuté |
|---|---:|---:|---:|---:|
| parse | 1 722,000 | **1 659,229** | 1 905,709 | 373,438 |
| decode | 688,042 | **661,375** | 636,938 | 274,458 |
| combined | 1 342,167 | **1 130,688** | 2 141,146 | 659,646 |

Combined : **−15,8 %** face au Rust précédent, **−47,2 %** face au Go publié,
et encore **1,71×** le C. Decode seul reste **3,8 %** au-dessus du Go dans cette
campagne. La campagne officielle indépendante confirme **1 122,833 µs** Rust ;
le Go générique reconstruit (**9 980,334 µs**) reste une autre référence.

Allocations combined par cas : plats **16 014→9 017**, imbriqués
**14 013→11 014**, optionnels **11 263→4 514**, Unicode **14 435→6 997**.
Le profil entier attribue **31 548** requêtes, réparties exactement entre
index (**5**), résultat (**31 527**) et reste (**16**), sans régions imbriquées.

Consommateur final : tableaux seuls **15 867,146→15 966,688 µs** combined
(**+0,63 %**, decode **+1,51 %**). Aucun gain isolé du consommateur de tableaux
n'est revendiqué. Face au contrôle antérieur `consume6-records`, l'ensemble
mesure **16 211,979→16 064,917 µs** combined ; ce contrôle incluait déjà le
partage local des absences et n'est pas le binaire publié `move-v1`.

Rapport : `altbak.pub/docs/benchmark-results/2026-09-30-rust-json-packed.{md,json}`.

### Jalon précédent : premiers workers et records natifs

Les plans natifs, `Record_a` sparse, les clés partagées, les accesseurs natifs
et le parser sur octets étaient déjà livrés à ce jalon.

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

### 2. Représentations natives intégrées — records et éléments de tableaux

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
- Étape suivante : les workers construisent directement des `Vec` de records
  concrets, de scalaires, ou de carriers ADT typés. `Value::NativeArray` et
  `NativeElement` transportent le résultat à travers l'ABI polymorphe. Un
  élément qui s'échappe garde son tableau propriétaire et son index ; il garde
  donc aussi le stockage des autres éléments en vie. Aucun curseur JSON ou
  travail de décodage différé ne s'échappe.
- Les ADT custom gardent leur `Rc<ADT>` existant ; leur tableau supprime le
  boxage `Value::Class` par élément. Les `Maybe` conservent leur représentation
  ordinaire. Ce chantier ne constitue pas encore une spécialisation complète
  des ADT paramétrés.
- Les `Nothing` produits par un même appel spécialisé partagent un carrier
  ordinaire, créé à la première absence. Le propriétaire temporaire reste sur
  la pile de cet appel ; tout est libéré avec les derniers résultats. Aucun
  cache global ni modification des CAF ou des constructeurs ordinaires.
  Le contrôle `Weak` de la fixture vérifie cette libération.
- Indexation, vues de parcours et folds n'allouent ni enveloppe d'élément
  record/ADT ni tableau intermédiaire. `unwrap_array` reste une conversion
  explicite pour les autres consommateurs. Projections,
  mises à jour, tri, filtrage, égalité, encodage et pont `Json.fromArray` sont
  couverts par les consommateurs ordinaires ; `--no-json-arrays` isole l'étape.
- Premier prototype : son propriétaire trait-object + index élargissait
  `Value` de **24 à 32 octets**, alourdissant le DOM et annulant le gain des
  allocations supprimées. La version corrigée garde un propriétaire mince :
  **24 octets** pour `Value`, sans `unsafe`. Les tableaux de records/ADT ont
  une boîte d'effacement supplémentaire par tableau, les scalaires non.
- Mesures et snapshots de cette étape :
  `altbak.pub/var/benchmark/json-packed-20260930/`. Les variantes à `Value`
  élargi (`packed-v1`, `packed-v2`) restent des expériences non retenues.
- `packed-v6` : combined **1 366,229 → 1 324,271 µs**, mais consommateur complet
  **16 683,313 → 17 245,688 µs**. La baisse d'allocations ne suffisait pas à
  justifier ce surcoût. `index-v7` supprime l'appel virtuel d'identification à
  chaque lecture et garde la longueur dans le propriétaire mince : consommateur
  appairé **16 772,417 → 16 706,792 µs**, sans enveloppe par élément.

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
- Essai suivant écarté : retourner directement le premier bit SWAR marqué
  (`trailing_zeros`) passe les contrôles fonctionnels, mais dégrade combined
  de **1 365,604 à 1 490,708 µs** dans la comparaison appairée isolée. Le scan
  retenu conserve la recherche scalaire dans le dernier mot. Le test conserve
  les cas supplémentaires à plusieurs caractères spéciaux et emprunts entre
  lanes. Rapport : `json-packed-20260930/scan-v4-paired.json`.
- Après attribution par piles : réserver les chaînes échappées grâce à la borne
  du token validé, puis copier les plages sans escape en bloc. Les `Int` décimaux
  courts validés utilisent une accumulation bornée ; tous les autres conservent
  la conversion IEEE-754 originale. Essai isolé **1 354,604 → 1 175,417 µs**.
- Les constructeurs `CtorDef` et leurs wrappers transfèrent les arguments
  possédés au lieu de cloner deux fois les chaînes : **1 190,605 → 1 172,126 µs**.
  Contrats explicites : adresse du buffer, une allocation ADT, identité des
  arguments partagés et application partielle réutilisable.
- Les aliases de fonctions globales transfèrent aussi leurs paramètres
  synthétiques possédés : cela retire la copie complète du texte par le wrapper
  `decodeText`. Le test codegen vérifie l'adresse du buffer à travers un alias.
- Les lectures String utilisées uniquement comme discriminateurs restent des
  curseurs locaux ; les lectures incluses dans le résultat restent possédées.
  Preuve par les usages du programme de succès, comparaison UTF-16, handshake
  **ABI3** et repli ordinaire avec les anciens ports. Essai isolé
  **1 159,896 → 1 141,646 µs** ; qualification finale ci-dessus.

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
- Ce blocage historique est désormais contourné par `bench/allocation-stacks.py` :
  la garde de réentrance est posée avant l'initialisation et la symbolisation.
  Un passage combined attribue **43 840 requêtes** sur `index-v7`, exactement
  le total des régions disjointes. Les piles démontrent les réallocations des
  chaînes échappées et les copies dans les constructeurs ; elles sont archivées
  dans `json-packed-20260930/stacks-v7/`. La cause du premier blocage n'est pas
  déduite rétroactivement du succès de ce nouveau diagnostic.
- Après les chaînes, les constructeurs et les discriminateurs, les piles de
  `borrow-v10` totalisent **31 553** requêtes : **−6 308** pour les buffers des
  chaînes échappées, **−3 502** dans `View`, **−2 477** pour les discriminateurs.
  Les `Just` ordinaires totalisent encore **6 308** requêtes. Ce sont des
  décomptes attribués ; leurs temps instrumentés ne constituent pas des cellules.
- `instrument.py` reconstruit maintenant TAST avant le profilage et vérifie les
  oracles individuels. Le premier `allocations-v10.json` réutilisait un ancien
  TAST ABI2 et a donc mesuré le décodeur ordinaire ; il est écarté. Les profils
  `stages-v10`/`stacks-v10` copient le workspace canonique neuf et sont valides.
- Nouveau diagnostic `bench/stages-json.py` : copie isolée des sources Rust
  générées, régions **disjointes** indexation / construction du résultat /
  reste de la fenêtre. Les compteurs mesurent les requêtes alloc+realloc et
  les octets demandés, pas la mémoire vivante. Les temps instrumentés restent
  diagnostiques et ne remplacent jamais la campagne appairée.
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
- [x] Tableaux concrets, propriétaires minces, projections directes et partage
      local des absences ; contrôles d'identité, d'allocations et de libération.
- [x] Attribution complète par piles ; chaînes, constructeurs, aliases et
      discriminateurs corrigés sur la base de ces mesures.
- [x] Version finale : codegen **81/81**, TAST **43/43**, fixture JSON dans cinq
      modes (**9 tests/mode**) et scanner Rc/Arc.
- [x] b8x final **286/286**, `build-Rue4Pa` ; compiler reconstruit proprement,
      étape Linux reprise après remplacement du conteneur pendant le build.
- [x] Campagnes finale appairée, consommateurs et officielle indépendantes au
      repos ; publication `2026-09-30-rust-json-packed.{md,json}`.

## Prochain jalon vers le C

Le jalon Go est franchi pour combined. Les tableaux de records/scalaires/ADT
sont désormais intégrés ; l'écart au C reste à réduire par des mesures isolées.

1. **Chaînes courtes possédées dans les résultats natifs.** La référence C utilise
   `std::string`, qui possède un stockage inline des petites chaînes. Un essai
   de layout Rust sûr donne 24 octets pour `Inline { len: u8, bytes: [u8; 15] } |
   Heap(String)`, mais 32 avec 23 octets inline. Sur le corpus, 8 450 chaînes
   non vides de champs records/tableaux scalaires tiennent dans 15 octets de
   l'encodage UTF-16 interne. C'est un inventaire de données, **pas un gain de
   temps établi**. Une éventuelle implémentation doit construire les octets
   possédés dans le worker et qualifier les conversions des consommateurs,
   ainsi que le chemin DOM qui fournit déjà des `String` allouées.
2. **ADT paramétrés et `Just`.** Le profil attribue encore 6 308 requêtes aux
   deux couches des carriers `Just`. Supprimer un boxage demande une projection
   compatible avec `UnknownType`, sans allocation à la lecture ni modification
   de l'identité du `Rc<ADT>`. Une simple représentation privée suivie d'une
   matérialisation après chronométrage ne convient pas.
3. **Indexation/scan.** Reprofiler au repos après chaque étape de représentation,
   puis tester une vectorisation plus large si elle cible le coût dominant.
   L'essai `trailing_zeros` rejeté ne constitue pas une preuve contre toutes
   les variantes du scanner.

Préserver exactement les contrats ci-dessus ; ne pas annoncer un facteur de
gain avant une mesure appairée qualifiée.
