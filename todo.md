# Purust — rapprocher JSON Decoding du Go/C (workers natifs + ABI)

Plan du 30 septembre 2026. Remplace le plan de réduction des ratios /C du
26 septembre (conservé à l'historique git).

## Objectif

Amener la cellule **JSON Decoding** de la table Rust d'`altbak.pub` au niveau du
Go publié, puis s'en rapprocher du C, et publier ensuite la cellule
**JSON to Typed AST**. Le levier n'est plus algorithmique : la mesure montre que
le coût restant est la représentation par valeur et l'ABI de décodage. Le
programme s'attaque donc aux deux, par étapes mesurables et validées par
l'oracle.

## État au 30/09/2026 (déjà en place)

| phase | C | Go publié | purust |
|---|---:|---:|---:|
| parse | 385 | 2 282 | 2 116 |
| decode | 276 | 762 | 4 475 |
| combined | 678 | 2 397 | **6 818** |

Harness officiel : purust 6 097, JS 8 835, Go générique 11 001. Depuis le début
du cycle : parse −40 %, decode −89 %, combined −84 %. Les 17 empreintes de
l'oracle (cas d'erreur compris) sont exactes ; tests 80/80 codegen et 41/42 TAST
(l'échec restant est l'environnement `js-bigints`).

Déjà livré : plans natifs (`FieldSpec`/`RecordPlan`), `Record_a` sparse, clés
`Rc<str>`, parser octet-à-octet, instances natives `Maybe`/`Array`/`Object`,
accesseurs `.:`/`.:?` natifs.

Mesures qui cadrent la suite :

- Le hoisting des dictionnaires (passe CAF, 233 sites) **n'apporte rien** :
  la construction des dictionnaires est déjà amortie par les plans. Passe
  retirée. Ne pas la refaire.
- Le decode restant = **133 054 allocations ≤ 127 octets par payload**
  (~6 par valeur JSON) : closures d'arguments créées par appel, `Rc<Either>` par
  appel de décodeur, `Rc<Maybe>` ×2 par `Just`, une copie de chaîne par valeur,
  un `Mutex` par lookup d'objet.

## Jalons (cibles, protocole appairé, mêmes binaires Go/C préservés)

| jalon | decode | combined | comparaison |
|---|---:|---:|---|
| M1 — allocations de la phase 1 | ≤ 3 200 µs | ≤ 5 500 µs | ≤ 2,3× Go publié |
| M2 — représentation (phase 2) | ≤ 2 000 µs | ≤ 4 000 µs | ≤ 1,7× Go |
| M3 — workers par schéma (phase 3) | ≤ 900 µs | ≤ 2 500 µs | ≈ Go publié |
| stretch texte→schéma | ≤ 500 µs | ≤ 1 800 µs | vers le C (276/678) |

Aucun jalon ne se publie avant : oracle bit-exact sur les 17 modules, campagne
harness complète, `t -c` b8x après tout changement de runtime.

## Phase 0 — outillage et hygiène (1-2 jours)

1. **Pousser les deux ports** : créer les remotes GitHub `purust-argonaut-core`
   et `purust-argonaut-codecs` (commits locaux `0af0f61`/`468e8ad`,
   `e92885f`/`83d1b11`/`61fc4fb`/`58b07c9`/`9c80c06`).
2. **Committer l'outillage de mesure** dans `purust/bench/` : compteur global
   d'allocations (par passe, histogramme de tailles, compteurs d'appels FFI) et
   script `paired.py` (6 permutations, médianes), pour que chaque jalon soit
   reproductible sans patch jetable du workspace.
3. **Revalider b8x** (`t -c`) avec le runtime courant (`Record_a` sparse,
   `Rc<str>`, `Mutex` conservé).

## Phase 1 — supprimer les allocations par appel (3-5 jours)

1. **Lambda lifting des fermetures closes en position d'argument.** Le profil
   montre des `Value::FuncN::Shared(Rc::new(...))` recréés à chaque appel
   (lambdas de repli des combinateurs, décodeurs partiels). Étendre l'idée CAF
   aux `Abs` **closes** : les hisser en valeurs/fonctions top-level avec leur
   type inféré, sans toucher aux arbres contextuels (records/littéraux), qui
   restent sur place (leçon du CAF : seules les spines d'appel et les closures
   closes sont déplaçables).
   Validation : compteurs d'allocations par cas + oracle.

   **État au 30/09 : implémenté sur la branche `edge-caf`, non fusionné.**
   **État au 30/09 : implémenté sur `edge-caf`, REJETÉ après mesure.**
   `Purust.Caf` hoiste les appels top-level clos et les lambdas closes
   (identité des locaux `(nom, niveau)`, refus des cycles, littéraux
   contextuels laissés en place). Tests codegen 80/80 et empreintes oracle
   exactes, mais :
   - les fixtures TAST échouent (contrats d'allocation exacts : `seeded` doit
     allouer 1 fois et conserver les pointeurs ; l'initialisation paresseuse
     des valeurs de module s'ajoute dans la fenêtre mesurée, 7 au lieu de 1) ;
   - **mesure appairée : régression** — decode 5 968 µs et combined 8 687 µs
     contre 4 475/6 818 sur `edge` (Go 2 202 et C 681 dans la même session,
     donc machine comparable). Le hoisting casse visiblement les fusions du
     codegen (`FunctionFusion`/`ListFusion`) et ajoute de l'indirection.
   Conclusion : ne pas refaire le lambda lifting générique. La phase 1 doit
   viser les allocations SANS déplacer de lambdas (ABI interne, conteneurs,
   primitives).

   **Attribution mesurée (30/09).** 100 % des allocations du decode sont dans
   le plan de payload (tout est imbriqué) ; le chemin `events` en porte 129 k
   sur 135 k : 119 allocations par événement minimal (« view »), 158 sans
   items, 182 avec un item. Les appels d'interface sont rares (3 `getField`,
   1 copie d'objet, 1 tableau) et sortir les défauts d'erreur en valeurs de
   module est **neutre** : purust partage déjà les valeurs closes. Une
   seconde tentative, le hoisting des **arbres de constructeurs fermés**
   (constantes d'erreur, seuil abaissé à 3 nœuds), est également **neutre**
   (135 054 allocations, identique). Constat : **aucune transformation de
   partage au niveau AST ne change les comptes d'allocations** ; le coût est
   structurel (boxage dynamique et closures d'enveloppe aux frontières).
   La phase 1 est close : aller directement en **phase 2
   (représentation/ABI)** — sommes non boxées et chaînes partagées — en
   traitant les contrats d'allocation TAST comme un point à réviser
   explicitement.

   **Attribution par backtraces (30/09, tentative).** Le gabarit
   `bench/backtrace-main.rs` (capture bornée dans l'allocateur) deadlocke :
   la symbolisation alloue et prend des verrous depuis `GlobalAlloc`. Piste
   propre si besoin : allocateur système + Instruments/MallocStackLogging,
   ou `#[global_allocator]` sans mimalloc. Preuve indirecte suffisante :
   les allocations restantes naissent dans la **plomberie émise par le
   codegen** (enveloppes `FuncN::Shared(Rc::new(...))` et boxages
   `Value::Class(Rc::new(...))` par évaluation), invisibles aux passes AST.
   Prochaine tentative ciblée : **cache par site de la matérialisation**
   (box enveloppe / closure d'enveloppe) dans `CodeGen`, avec identité de
   site et cellules thread-local, sans déplacer les lambdas.
2. **ABI interne de décodage sans `Rc<Either>`.** Introduire dans le port un
   type de résultat interne par valeur (`enum Decoded { Ok(UnknownType),
   Err(Rc<JsonDecodeError>) }`) pour les chemins plan/instance/accesseurs ;
   ne construire `Rc<Either>` qu'à la frontière publique. Les erreurs continuent
   de venir du `step` générique (identiques à l'oracle).
3. **Objets sans verrou.** Mesurer un chemin de lecture sans `Mutex` pour les
   objets immuables (parser/Json) tout en gardant la variante `Sync` pour le
   mode threaded et `Object.ST` (évaluer `RwLock` lecture ou carrier dédié).
4. **Nombres/entiers** : vérifier que le décodage primitif ne fait plus de
   travail inutile (conversion, boxing) ; tests de non-régression d'oracle.

## Phase 2 — représentation et ABI (1-2 semaines)

Le gain structurel restant. Chaque point est un changement large : une PR par
point, campagne complète, publication seulement après.

1. **Sommes non boxées pour les ADT non récursifs** en position typée
   (`Maybe`, `Either`, `JsonDecodeError`, énumérations utilisateur), avec
   boxage uniquement aux frontières `UnknownType`. C'est le facteur ×2 à ×3
   attendu sur decode. Touche `DataLayout`, `CodeGen`, les ports et leurs
   conversions.
2. **`Value::String` partagé** (`Rc<str>`) pour supprimer la copie par valeur
   décodée ; mettre à jour codegen, runtime et ports (helpers `mk_string`/
   `unwrap_string` d'abord, matches directs ensuite).
3. **Clés et listes** : généraliser le partage `Rc<str>` aux objets construits
   par le parser et aux enregistrements reconstruits ; mesurer la suppression du
   `Vec` intermédiaire dans `nativeObject`.
4. **Protocole d'acceptation** : à chaque point, M2 et oracle exact ; sinon
   revert.

## Phase 3 — workers natifs par schéma (2-4 semaines)

L'équivalent purust des « schema workers » gopurs (`schemaDecoderABI1`), qui ont
fait passer Go de 7,6 ms à 0,67 ms.

1. **Reconnaissance compilateur du schéma.** Pour chaque composition concrète
   `DecodeJson (Record row)` résolue à la compilation, émettre un worker natif :
   table statique des champs, décodage primitif en ligne, récursion sur les
   schémas imbriqués, appels aux seuls décodeurs custom nécessaires. Plus de
   plan, plus de `step`, plus de dictionnaire au runtime ; l'ABI reste
   `Either` à la frontière.
2. **Texte → schéma.** Pour `decodeJsonString*` (phase combined), décoder
   directement depuis le texte validé : un des deux backends de worker (DOM ou
   texte), comme gopurs. Objectif : combined ≤ 1,8 ms.
3. **Handshake de version** entre les ports et le compilateur pour garder la
   compatibilité (ABI `schemaDecoderABI`), avec repli automatique sur le chemin
   générique actuel.

## Phase 4 — JSON to Typed AST (1 semaine, parallélisable)

- Port du driver `src/Test/JsonTypedAst.rs` (même protocole que `JsonDecoding`),
  compilation du PBO par purust, `parseModuleTextImpl` délégué au repli PS comme
  en JS.
- Validation oracle (`fingerprints`), campagne appairée, publication de la
  cellule (Go 19 977,96 / C 10 823,13).
- Bénéficie de toutes les phases précédentes (mêmes décodeurs de records).

## Garde-fous

- L'oracle (`fingerprints` + `json_fingerprints`, 17 modules) est la référence
  absolue à chaque mesure ; toute divergence est un bug du chemin mesuré.
- Ne pas casser l'état vert : les cellules publiées ne changent qu'après
  campagne complète et tests verts.
- Chaque changement de runtime passe par `t -c` b8x (le runtime est partagé).
- Le codejet reste limité au besoin identifié (cf. `AGENTS.md`).

## Première semaine, concrètement

1. Phase 0 complète (remotes, outillage committé, b8x).
2. Phase 1.1 (lambda lifting) : implémentation, compteurs, oracle, campagne.
3. Phase 1.2 (ABI interne) : prototype sur le port argonaut-codecs, mesure.
