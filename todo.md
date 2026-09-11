# Faire tourner les tests b8x avec des FFI Rust `.rs`

Mis à jour le 12 septembre 2026.

## Objectif

Permettre à la suite de tests de b8x d'être compilée et exécutée avec purust,
en utilisant des FFI Rust locales (`.rs`), tout en conservant les chemins JS,
Go et PHP existants.

Interface proposée, non encore implémentée :

```sh
./bin/test --runtime rust
```

Le chemin Rust devra sélectionner explicitement son backend, son point d'entrée
et ses répertoires. Le nom exact de l'option reste à fixer en phase 1 ; conserver
la compatibilité des commandes existantes. La validation des autres backends
porte sur les comportements déjà pris en charge, pas sur un nouveau portage
complet de b8x vers chacun d'eux.

## Choix du modèle de travail

Référence : [documentation officielle sur les modèles](https://developers.openai.com/api/docs/models).
La répartition ci-dessous est une recommandation pour ce projet, pas une mesure
comparative des deux modèles sur b8x. Ces listes attribuent les responsabilités ;
seules les cases des phases suivent l'avancement du travail.

Règle générale : utiliser `gpt-6-astra` pour les décisions difficiles, les
diagnostics et les validations de sémantique ; utiliser `gpt-5.6-luna` pour les
tâches nombreuses, répétitives et précisément bornées. Luna ne doit pas être
chargée de trancher seule une question d'architecture, d'ABI ou de sémantique
du compilateur.

### Utiliser Astra

- **Phase 0 — tranche verticale** : choisir le premier test, comprendre le
  graphe de dépendances, analyser le Rust généré et diagnostiquer un échec de
  résolution FFI.
- **Phase 1 — profil Rust** : décider de l'interface `--runtime rust`, de la
  séparation des sorties et de la compatibilité avec les runners existants.
- **Phase 2 — runner** : concevoir la séparation Node/backend-neutre, le
  contrat de sortie, l'attente des callbacks et les codes d'erreur.
- **Phase 4 — Aff et concurrence** : analyser les annulations, les fibres,
  les erreurs asynchrones, les races et les durées de vie.
- **Phase 6 — première intégration externe** : choisir l'architecture Rust
  pour PostgreSQL, RabbitMQ et EventStore, puis valider le premier adaptateur.
- **Phase 7 — purust** : modifier le générateur, le contrat FFI, les stubs,
  la résolution des chemins ou la propagation Cargo.
- **Tout échec ambigu** : reprendre avec Astra dès qu'il faut distinguer un
  problème de TAST, de code généré, de runtime Rust, de FFI ou de service
  externe.
- **Revue de jalon** : relire les changements de code sensibles et les preuves
  d'exécution avant M1, M2, M3 ou M4. Un relevé de résultat ou une correction
  documentaire ne nécessite pas systématiquement une revue supplémentaire.

Niveau conseillé : `high` ou `xhigh` pour le compilateur, l'ABI, Aff et les
intégrations ; `max` seulement pour une impasse réellement complexe ou une
revue finale à fort enjeu.

### Utiliser Luna

- **Inventaire Phase 3** : parcourir les modules, relever les FFI existantes,
  classer les fonctions utilisées et maintenir la matrice de couverture.
- **Portages répétitifs Phase 3** : appliquer un contrat déjà validé à des
  FFI simples, créer les squelettes `.rs`, renommer les symboles et ajouter les
  cas de test prévisibles.
- **Phase 5 — suite unitaire** : lancer les mêmes commandes, collecter les
  sorties, comparer les résultats et mettre à jour les tableaux de couverture.
- **Phase 6 après le premier adaptateur validé par Astra** : reproduire les
  fixtures établies et les opérations simples au même contrat. Les transactions,
  callbacks, annulations et durées de vie restent du ressort d'Astra.
- **Phase 7 après décision d'Astra** : appliquer les corrections mécaniques
  dans les configurations et compléter la documentation ; les changements du
  générateur ou du runtime restent du ressort d'Astra.
- **Validation locale ciblée** : relancer un test précis après une petite
  modification dont le contrat et la commande sont déjà connus.

Niveau conseillé : `low` ou `medium` pour les tâches bornées ; `high` seulement
si Luna doit suivre un graphe de dépendances déjà documenté. Chaque tâche Luna
doit avoir un fichier cible, une commande de validation et un critère de sortie
explicites.

### Règle de passage entre modèles

1. Astra définit le contrat et réalise la première implémentation risquée.
2. Luna déroule les variantes mécaniques et les validations répétitives.
3. Astra examine les diffs, les erreurs résiduelles et les effets de bord avant
   de passer au jalon suivant.
4. Revenir à Astra dès qu'un échec n'a pas de cause locale établie, que le
   résultat attendu est incertain ou qu'une correction touche le compilateur,
   le runtime, l'ABI ou la concurrence. Transmettre la commande, le code de
   sortie, la trace utile et les fichiers concernés.

## État actuel

### b8x

- [`b8x/bin/test`](../../b8x/bin/test) délègue à [`b8x/bin/run`](../../b8x/bin/run).
- `bin/run` sait actuellement exécuter JS, Go et PHP, mais pas Rust.
- La configuration racine `b8x/spago.yaml` pointe vers la configuration JS.
- b8x possède désormais une FFI `.rs` locale pour l'encodage/décodage HTML,
  validée en 0.14 ; les autres modules restent à inventorier et porter.
- [`b8x/test/Main.purs`](../../b8x/test/Main.purs) dépend de `spec-node`,
  `Node.Process` et `keepMainAlive`. Il utilise aussi `Effect.Now`, une API
  PureScript dont l'implémentation doit être disponible sous Rust, même avec
  le runner générique.
- Les tests couvrent des modules purs/utilitaires, l'EventStore PostgreSQL et
  les projections PostgreSQL, avec RabbitMQ dans leurs fixtures. EventStore
  désigne ici une couche b8x, pas un troisième serveur à déployer.
- Les clients PostgreSQL et RabbitMQ utilisent `Promise` et `Promise.Aff` à
  leur frontière FFI : leur pont Rust est un prérequis des intégrations.

### purust

- [`src/Main.purs`](src/Main.purs) utilise `findFfiFile ".rs"`.
- La recherche d'un FFI local voisin suit normalement le chemin :
  `src/X/Y.purs` -> `src/X/Y.rs`.
- Les fonctions Rust doivent respecter les noms qualifiés attendus, par exemple
  `Module_Function`.
- Le générateur concatène actuellement le Rust fourni par le FFI et ajoute des
  stubs de secours lorsqu'il ne trouve pas certains symboles.
- Cette stratégie doit être vérifiée sur une tranche verticale avant de porter
  une suite réelle : un stub qui compile ne constitue pas une FFI fonctionnelle.
- Une partie de l'écosystème `purust-*` possède déjà des FFI Rust, mais la
  couverture de `purust-spec`, des runners Node et de plusieurs packages Node
  reste incomplète.
- Le compilateur accepte `--source`, `--out`, `--main` et `--threaded`.
  `--main` choisit le point d'entrée ; le code actuel charge et transmet au
  générateur tous les modules trouvés dans `--source`. Il ne constitue donc
  pas un filtre suffisant pour une première compilation isolée de b8x.
- Certains chemins Cargo de `perceus_ptr` sont absolus. Ils peuvent permettre
  un essai sur cette machine, mais devront être configurables ou dérivés de
  l'installation du compilateur pour le runner final et Docker.

### Acquis à réutiliser

L'ancien todo, conservé dans Git (`git show 157cbac:todo.md` depuis ce dépôt),
rapporte une validation du 10 septembre : **45 tests Aff**, **5 groupes de
concurrence**, **4 scénarios de durée de vie**, et un bilan final de
**13 runners de paquets, 41 vérifications codegen et 16 suites TAST**.
Cela couvre notamment assert, console, effect, refs, functions, exceptions,
avar, arrays, foldable-traversable, unfoldable, unsafe-coerce et partial.
Ce sont des résultats historiques, non réexécutés lors de cette revue.

Le runner [`purust-aff/bin/test`](../purust-aff/bin/test) utilise `--threaded`.
Dans `src/Main.purs`, la présence d'Aff avec cette option active l'enveloppe
`purust_aff_run_main`, qui prend en charge la durée de vie du programme.
Réutiliser ce socle pour b8x ; la phase 4 vérifie son intégration et ses
non-régressions, elle ne recommence pas un portage d'Aff.

Les cycles forts de références `Rc`/`Arc` restent une limite connue. Leur
collecte générale est un chantier distinct, sauf blocage mesuré des tests b8x.

## Définition de terminé

- La commande intégrée retenue (proposition : `./bin/test --runtime rust`)
  sélectionne toujours la configuration Rust.
- Un sous-ensemble de tests b8x purs compile avec le TAST du fork local et
  s'exécute réellement sous Cargo.
- Une FFI `.rs` locale est découverte, incluse et exécutée ; aucun fallback vide
  n'est silencieusement utilisé.
- Les succès et les échecs des tests donnent les bons codes de sortie.
- Le runner attend bien la fin des effets asynchrones avant de terminer.
- Toute la suite unitaire b8x est portée avant les intégrations externes.
- Les intégrations des clients, de l'EventStore et des projections sont ensuite
  exécutables avec les services PostgreSQL/RabbitMQ de la suite actuelle.
- Tous les tests actifs de la suite b8x passent sous Rust avec leurs assertions
  préservées ; une exclusion temporaire laisse l'objectif incomplet.
- Les changements des scripts communs ne dégradent pas les chemins JS, Go et
  PHP par rapport aux références réellement relevées.

## Ordre d'exécution et jalons

Les phases ci-dessous regroupent les sujets ; elles ne sont pas huit blocs à
terminer successivement. La phase 0 nécessite un minimum des phases 1, 2, 3,
4 et 7 : environnement isolé, runner Spec compatible, FFI d'encodage,
`--threaded` et contrôle des FFI manquantes.

1. **M1** : référence JS ciblée, puis les deux tests existants sous Rust et
   une fixture négative, avec TAST frais et FFI réelle. Les FFI de bibliothèques
   nécessaires au runner sont des prérequis supplémentaires au fichier b8x.
2. **M2** : intégration aux scripts b8x et ensemble des tests sans services,
   identifiés par leur graphe de dépendances, quel que soit leur dossier.
3. **M3** : contrats des clients PostgreSQL/RabbitMQ et pont Promise/Aff validés.
4. **M4** : suites EventStore, projections et suite complète b8x ; aucun test
   actif retiré pour obtenir une réussite.

Préparer le contrôle des FFI absentes avant M1. La portabilité Docker et la
généralisation de l'interface des scripts peuvent suivre cette première preuve.

## Phase 0 — Tranche verticale empirique

But : valider le pipeline complet avec le moins de variables possible.

- [x] Relever le résultat de référence d'un petit test b8x pur avec le runtime
  JS actuel : deux tests passés, zéro échec, zéro pending, sortie 0.
- [x] Choisir un test b8x sans PostgreSQL, RabbitMQ ni EventStore :
  `Util.Html.Encode.Test.EncodeHtmlEntities` (sélection par lecture et
  exécution le 11 septembre ; voir la micro-étape 0.1 ci-dessous).
- [x] Préparer un point d'entrée PureScript qui importe cette spec inchangée,
  avec `Proem` selon les conventions b8x. Fournir au compilateur un répertoire
  TAST limité à ses dépendances et conserver les chemins des sources réelles
  (211 modules compilés, micro-étape 0.2).
- [x] Inventorier les déclarations étrangères du graphe réel : 52 modules,
  dont 13 sans `.rs` voisin ; voir le manifeste de la micro-étape 0.2.
- [x] Qualifier cet inventaire par le résolveur et une génération diagnostique :
  29 symboles remplacés par des fallbacks, dont 20 encore référencés dans le
  Rust produit (micro-étape 0.3). Une référence conservée ne prouve pas à elle
  seule que le test exécutera ce chemin.
- [ ] Valider les prérequis Spec/Now et leurs dépendances ; la présence d'un
  fichier ne prouve pas sa compatibilité. `Test.Spec.Console.write` et
  `Effect.Now.now` sont validées isolément (0.4–0.5). `Data.Exists` est
  corrigé et validé en 0.6, `Data.Lazy` en 0.8, `MonadAff` en 0.9 et
  `freeMonadRec` en 0.10 et `Pipes.Internal.X` en 0.11. Le `cargo check`
  du graphe complet passe. `Record.Unsafe.unsafeSet` est corrigé en 0.13.
  Avec la vraie FFI HTML (0.14), les deux tests ciblés passent, résumé
  `2/2 tests passed` et sortie 0. Le chemin positif est validé ; le chemin
  négatif et les fallbacks conservés restent à qualifier (13 référencés).
- [x] Ajouter une seule FFI `.rs` nécessaire au runner :
  `purust-spec/src/Test/Spec/Console.rs` (micro-étape 0.4).
- [x] Vérifier que `findFfiFile ".rs"` découvre bien ce fichier local voisin.
- [x] Porter `Effect.Now.now` et vérifier sa résolution, sa définition générée
  et son effet différé rejouable en modes normal et threaded (0.5).
- [x] Générer un TAST frais avec le binaire du fork PureScript local identifié
  dans la micro-étape 0.2.
- [x] Générer le Rust en utilisant les arguments `--threaded` consignés dans
  le manifeste (génération diagnostique 0.3, sans Cargo). Le profil de
  préparation ne lance toujours pas automatiquement le backend.
- [x] Inspecter le Rust généré : nom qualifié, type de retour, arité, captures
  et absence de stub à la place de `Test_Spec_Console_write` et `Effect_Now_now`.
- [x] Valider `cargo check` sur le projet généré : premier essai en 0.5,
  premier succès sur les 211 modules en 0.11, sortie **0**.
- [x] Construire le binaire du projet Cargo généré : build et édition de
  liens réussis en 0.12, sortie **0**.
- [x] Effectuer une première exécution diagnostique bornée : les deux cas
  HTML sont atteints en 0.12, puis sortie **101** sur `unsafeSet`.
- [x] Valider une exécution complète de la spec ciblée avec la vraie FFI HTML
  Rust : deux tests, quatre assertions, résumé complet et sortie 0 (0.14).
  Les cas vides verts de 0.12–0.13, obtenus avec le fallback, ne comptaient pas.
- [ ] Vérifier séparément un test qui réussit et un test qui doit échouer.
- [ ] Vérifier les codes de sortie et les messages d'erreur.

Critère de sortie : un test b8x réel, avec une FFI Rust réelle, passe de
PureScript à TAST, puis à Rust/Cargo, avec un résultat observable correct.

### Micro-étape 0.1 — Test et contrat choisis avec Astra

Sélection terminée le 11 septembre 2026 par lecture des sources et inspection
statique des imports JS générés. La référence JS a ensuite été exécutée ; aucun
build Rust ni portage FFI n'a encore été exécuté.
Révisions inspectées : b8x `66250cf5e8`, purust `157cbac`.

La première spec est
[`Util.Html.Encode.Test.EncodeHtmlEntities`](../../b8x/src/Util/Html/Encode/Test/EncodeHtmlEntities.purs).
Elle contient deux tests et quatre assertions. Le calcul testé est pur ; son
harness utilise toutefois `Aff`, `Test.Spec` et `Test.Util.Assert`.

| Entrée | Sortie exacte attendue |
| --- | --- |
| `<div>` | `&#x3C;div&#x3E;` |
| `Hello & world` | `Hello &#x26; world` |
| `"quoted text"` | `&#x22;quoted text&#x22;` |
| chaîne vide | chaîne vide |

Les assertions existantes font foi : les entités nommées telles que `&lt;`
ne sont pas interchangeables avec ces sorties hexadécimales. Le commentaire
d'exemple du module d'encodage utilise une autre représentation.

**FFI locale ciblée :**
`b8x/src/Util/Html/Encode/Encode.rs`, à créer à côté de
[`Encode.purs`](../../b8x/src/Util/Html/Encode/Encode.purs).
Le chemin appelé est `encodeHtmlEntities -> _encodeHtmlEntities`, avec le type
PureScript déclaré `String -> String`. D'après le générateur actuel, la
signature Rust attendue est
`pub fn Util_Html_Encode_Encode__encodeHtmlEntities(input: String) -> String` ;
à confirmer sur le TAST frais et le Rust produit.

Il s'agit d'un seul fichier FFI, mais le module déclare aussi
`_decodeHtmlEntities`. Le générateur parcourt actuellement toutes ses
déclarations étrangères et peut produire un fallback pour ce second symbole.
Lors du portage, vérifier s'il est conservé et, s'il l'est, fournir son
implémentation réelle dans le même fichier, avec ses tests de décodage propres.
Le succès de la spec d'encodage ne validera pas le décodage ni la couverture
HTML/Unicode complète. Implémenter un contrat général, sans cas particuliers
codés pour les quatre exemples. Respecter la représentation des chaînes du
runtime purust lors du passage à une bibliothèque Rust.

**Dépendances identifiées :** la spec importe `Proem`, `Effect.Aff`, `Test.Spec`,
`Test.Util.Assert` et le module d'encodage. `Proem` ajoute les helpers
PureScript du projet ; l'assertion utilise `Eq`, `Show` et
`Test.Spec.Assertions.fail`. Côté JS, `Encode.js` utilise `Util.Runtime` et
charge dynamiquement le package `he` sous Node. La future FFI Rust devra
implémenter le contrat d'encodage nativement. Le runner générique appelle
`Effect.Now.now` pour chaque test ; supprimer le chronométrage de `Test.Main`
ne supprime pas cette dépendance.

L'inspection statique des sorties JS existantes, en partant de cette spec,
du runner générique, du reporter console et du résumé, trouve 158 modules.
Les seuls modules b8x retenus sont la spec, `Test.Util.Assert`,
`Util.Html.Encode.Encode` et `Util.Runtime` ; aucun module `Core`, `Infra`,
`Inter` ou `Node.*` n'apparaît dans ce parcours. Cette inspection porte sur
les imports statiques du JS existant, pas sur la fermeture TAST future ni
sur l'ensemble des chargements dynamiques.

**Commande JS de référence exécutée par Luna.**
Depuis la racine b8x, elle charge la spec existante et le runner générique,
attend son résultat Aff et exige exactement deux tests réussis. Ses appels
ont été vérifiés par lecture des exports générés et par exécution. Les sorties
JS inspectées portent des dates de modification du 3 septembre ; cela ne
prouve pas leur correspondance avec le checkout actuel. Ce résultat est donc
une référence fonctionnelle sur les artefacts actuels ; il sera renouvelé
après compilation fraîche avant de conclure à la parité avec Rust.

Le runner générique renvoie ici une `Aff (Aff résultats)` parce que `evalSpecT`
est instancié avec `Aff` comme monade de génération. La commande exécute l'effet
de construction, puis l'effet de test qu'il renvoie. Elle importe explicitement
`defaultConfig` depuis `Test.Spec.Config` ; `Test.Spec.Runner` le réexporte
également. L'aplatissement par `bind` de la commande initiale était lui aussi
cohérent avec cette API.

```sh
cd /Users/0x1/Documents/htdocs/b8x &&
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import * as Aff from './run/bak/js/output/Effect.Aff/index.js';
import { Left } from './run/bak/js/output/Data.Either/index.js';
import * as Config from './run/bak/js/output/Test.Spec.Config/index.js';
import * as Runner from './run/bak/js/output/Test.Spec.Runner/index.js';
import { consoleReporter } from './run/bak/js/output/Test.Spec.Reporter.Console/index.js';
import { summarize } from './run/bak/js/output/Test.Spec.Summary/index.js';
import { spec } from './run/bak/js/output/Util.Html.Encode.Test.EncodeHtmlEntities/index.js';

const runAff = aff => new Promise((resolve, reject) => {
  Aff.runAff(result => () => {
    if (result instanceof Left) reject(result.value0);
    else resolve(result.value0);
  })(aff)();
});

const nested = Runner.evalSpecT(Aff.functorAff)
  ({ ...Config.defaultConfig, exit: false })([consoleReporter])(spec);
let watchdog;
try {
  watchdog = setTimeout(() => {
    console.error('EncodeHtmlEntities did not finish within 15 seconds');
    process.exit(1);
  }, 15_000);
  const tree = await runAff(nested);
  const results = await runAff(tree);
  const counts = summarize(results);
  console.log(JSON.stringify(counts));
  assert.deepEqual(counts, { passed: 2, failed: 0, pending: 0 });
} finally {
  clearTimeout(watchdog);
}
JS
baselineStatus=$?
printf 'Baseline exit code: %s\n' "$baselineStatus"
test "$baselineStatus" -eq 0
```

Résultat exécuté le 11 septembre 2026 : un groupe contenant deux tests
réussis, résumé `2/2 tests passed`, puis
`{"pending":0,"passed":2,"failed":0}` et code de sortie `0`.

Ne pas utiliser `./bin/test --example ...` pour cette mesure :
[`Test.Main`](../../b8x/test/Main.purs) transmet directement `defaultConfig`
à `runSpecAndGetResults`, sans appeler `fromCommandLine`. Le filtre transmis
par les scripts n'est donc pas appliqué. De plus, `bin/run` transforme
actuellement le code 139 en succès dans son chemin Docker ; la validation
des échecs devra contrôler ce comportement lors de l'intégration du runner.

**Critères de sortie de la future tranche Rust :** mêmes deux tests et quatre
assertions inchangés, `passed = 2`, `failed = 0`, `pending = 0`, sortie 0 après
la fin d'Aff et preuve que le symbole de la FFI locale est bien exécuté.
Une fixture négative isolée devra produire un échec et une sortie non nulle.
Ne pas remplacer la suite PureScript par quatre assertions Rust autonomes.
Une sortie 0 avec zéro test, un skip ou une interruption ne satisfait pas M1.

La référence JS est terminée. Le point d'entrée et le profil TAST sont décrits
ci-dessous ; la prochaine action porte sur les prérequis de génération Rust.

### Micro-étape 0.2 — Point d'entrée et profil TAST préparés avec Astra

Réalisée le 11 septembre 2026. Le profil se trouve dans
[`b8x/run/bak/rust`](../../b8x/run/bak/rust/README.md) et comprend :

- [`src/Main.purs`](../../b8x/run/bak/rust/src/Main.purs), module
  `Test.Rust.EncodeHtmlEntities.Main` : import de la spec originale,
  deux niveaux Aff exécutés successivement, `exit = false` et erreur Aff si
  le résumé n'est pas exactement deux réussites, zéro échec, zéro pending ;
- [`spago.yaml`](../../b8x/run/bak/rust/spago.yaml) et son lockfile propres :
  package set 77.10.1 et overrides natifs locaux, dont `purust-spec` 8.1.2 ;
- [`prepare.mjs`](../../b8x/run/bak/rust/prepare.mjs) : résolution Spago hors
  ligne, sélection par `purs graph`, compilation des seuls modules retenus,
  contrôle des layouts/types TAST et inventaire des FFI voisines.

Commande exécutée depuis b8x : `node run/bak/rust/prepare.mjs`.
La préparation finale retourne **0**, avec **211 modules compilés**, sans
erreur ni avertissement du compilateur. Aucun module `Core.*`, `Infra.*`,
`Inter.*` ou `Node.*` n'appartient à ce graphe. Les chemins des sources b8x
d'origine sont préservés ; les assertions n'ont pas été copiées ou modifiées.

Le manifeste de validation est
[`output/prepare-fpWEyc/manifest.json`](../../b8x/run/bak/rust/output/prepare-fpWEyc/manifest.json),
et les commandes et sorties sont dans
[`commands.json`](../../b8x/run/bak/rust/output/prepare-fpWEyc/commands.json).
Ces artefacts sont ignorés par Git et recréés dans un dossier neuf à chaque
préparation. Le manifeste contient les empreintes du binaire, du lockfile et
des sources ainsi que les futurs arguments du backend avec `--threaded`.

Outils : Spago **1.0.3** ; le binaire `purs` sélectionné dans le fork annonce
`0.15.16 [development build; commit: 65010ea6512741ef38b3027c6f25d82511c648cd DIRTY]`.
Le checkout du fork est `a6a9864` : cette validation utilise le binaire existant,
pas une recompilation de ce HEAD. Les contrôles TAST ont réussi, notamment
les tableaux `dataDecls`/`classDecls`, `typeTable`, les types étrangers et les
chemins sources. Avant une validation d'un changement du compilateur, reconstruire
le binaire concerné et enregistrer sa nouvelle empreinte.

**Inventaire observé, à qualifier avant le portage :**

| Modules sans `.rs` voisin | Suite à donner |
| --- | --- |
| `Effect.Now` | Horloge requise par Spec ; qualifier ses deux imports étrangers. |
| `Test.Spec.Assertions`, `Test.Spec.Console`, `Test.Spec.Runner` | Distinguer les fonctions exécutées des déclarations conservées par le backend. |
| `Data.Date`, `Data.DateTime`, `Data.DateTime.Instant` | Dépendances de Now et du calcul de durée ; vérifier les primitives disponibles. |
| `Control.Extend`, `Data.Int.Bits`, `Data.Lazy`, `Data.Show.Generic`, `Data.Symbol` | Contrôler la prise en charge intrinsèque avant de créer une FFI. |
| `Util.Html.Encode.Encode` | Premier FFI b8x à porter, après les prérequis du runner. |

Deux autres fichiers `.rs` sont présents mais le relevé textuel ne trouve pas
tous les noms attendus : `Data.Int.fromStringAsImpl`,
`Record.Unsafe.unsafeSet` et `Record.Unsafe.unsafeDelete`. Ce relevé ne reproduit
ni le résolveur complet ni la génération des primitives et ne suffit pas à
conclure qu'ils sont absents du code natif.

Le TAST frais confirme les deux déclarations `_encodeHtmlEntities` et
`_decodeHtmlEntities`, de type `String -> String` via `typeTable`. À la fin
de cette micro-étape, aucun `.rs` b8x n'avait été ajouté, et ni le backend Rust
ni Cargo n'avaient été exécutés. Les liens JS de la racine b8x sont conservés.

### Micro-étape 0.3 — Qualification FFI avec Astra

Réalisée le 11 septembre 2026, sans portage ni modification du compilateur.
Les empreintes des **211 sources** du manifeste 0.2 ont été revérifiées :
toutes sont inchangées. Le même TAST a été réutilisé pour une génération
diagnostique dans un nouveau dossier, distinct des sorties précédentes.

Depuis `purust/purust`, commande exécutée :

```sh
./bin/purust \
  --source ../../b8x/run/bak/rust/output/prepare-fpWEyc/tast \
  --out ../../b8x/run/bak/rust/output/qualify-i0901q/rust \
  --main Test.Rust.EncodeHtmlEntities.Main --threaded
```

Résultat : **211 modules Rust générés, sortie 0**. Cargo et les tests Rust
n'ont pas été exécutés. Le main produit utilise bien `purust_aff_run_main` ;
cela prouve la sélection de l'enveloppe, pas encore son exécution avec Spec.
Le backend est le bundle existant `bin/purust.js`, non reconstruit ici,
SHA-256 `48589d7d7c6d659a7337fa22f6257d089ed77031a653b277dbb175d87ba8e456`.
Sources inspectées : purust `157cbac`, PBO réellement configuré
`purescript-backend-optimizer-purust` `82438c1`.

Attention : le PBO écrit `.purmeta` relativement au dossier courant, même
avec `--out` isolé. Les 58 fichiers suivis, initialement propres, modifiés
par ce diagnostic ont été restaurés ; les 119 nouveaux fichiers de cache
ont été déplacés dans `qualify-i0901q/generated-purmeta`, avec une copie
des 58 versions générées. Pour les prochains diagnostics, isoler aussi ce
cache et revérifier la résolution FFI depuis le dossier de travail choisi.

Preuves locales, ignorées par Git :

- [`audit.mjs`](../../b8x/run/bak/rust/output/qualify-i0901q/audit.mjs) :
  diagnostic exécuté, vérification des empreintes, résolution et génération ;
- [`generation.json`](../../b8x/run/bak/rust/output/qualify-i0901q/generation.json) :
  arguments absolus réellement transmis, empreinte, statut et sorties ;
- [`resolution.json`](../../b8x/run/bak/rust/output/qualify-i0901q/resolution.json) :
  résultats du `findFfiFileImpl` du PBO local avec les arguments du backend ;
- [`symbols.json`](../../b8x/run/bak/rust/output/qualify-i0901q/symbols.json) :
  définitions fallback et références avec leurs fichiers/lignes Rust.

Ces fichiers ont été réécrits par la relance de la micro-étape 0.4 : ils
contiennent maintenant la vraie FFI console. Les comptes et le tableau qui
suivent décrivent l'observation historique 0.3. La micro-étape 0.5 possède
ses propres sorties et recalcule les présences depuis les fichiers actuels.

**Résolution initiale 0.3 :** 39 fichiers voisins retrouvés, aucun chemin alternatif pour
les 13 modules sans voisin. Les trois noms absents des deux fichiers présents
ne sont pas fournis par une autre résolution. Le code de `src/Main.purs`
ajoute un fallback pour chaque déclaration étrangère typée absente ; il ne
filtre pas ces déclarations selon leurs usages. La génération confirme
**29 fallbacks**, dont 20 symboles avec des références hors définition et
9 sans référence dans ce Rust. Ces comptes portent sur les noms exacts,
pas sur un graphe d'appels dynamiques ni une preuve de couverture.

| Module / symboles | Qualification et conséquence |
| --- | --- |
| `Control.Extend.arrayExtend` | Pas d'intrinsèque identifié ; fallback `unimplemented!()` référencé par l'instance tableau conservée. À porter ou à éliminer avec cette instance après preuve d'inutilisation. |
| `Data.Date` : `canonicalDateImpl`, `calcWeekday`, `calcDiff` | Trois vrais manques, tous référencés par leurs wrappers. Les fallbacks `FnN` sont même sans argument : ne pas prendre leur signature comme contrat. |
| `Data.DateTime` : `calcDiff`, `adjustImpl` | Deux vrais manques référencés. Le chronométrage Spec utilise `Instant.diff`, pas cette FFI `calcDiff`. |
| `Data.DateTime.Instant` : `fromDateTimeImpl`, `toDateTimeImpl` | Deux vrais manques référencés par les conversions conservées. `Instant.diff` est du PureScript sur des millisecondes ; chronométrer les tests n'impose pas ces conversions à l'exécution. |
| `Data.Int.fromStringAsImpl` | Vrai symbole manquant dans `Data/Int.rs`, encore référencé par le parsing. Pas d'intrinsèque identifié. |
| `Data.Int.Bits` : les sept fonctions | Le PBO les transforme en opérations primitives, émises par `Purust.CodeGen`. Aucun appel à ces sept noms dans le Rust produit, mais leurs sept fallbacks `0` restent définis. Candidats à suppression contrôlée, pas FFI validées ni preuve de parité bit à bit sur tous les cas. |
| `Data.Lazy.defer`, `force` | Pas d'intrinsèque ; deux fallbacks référencés dans `Data.Lazy`, `Control.Monad.List.Trans` et `Control.Comonad.Cofree`. Le type étranger `crate::Lazy` est aussi référencé. Portage de la mémorisation et du type natif, ou élimination prouvée des bindings concernés : travail Astra. |
| `Data.Show.Generic.intercalate` | Fallback chaîne vide, encore référencé par le Show générique. Pas d'intrinsèque identifié. |
| `Data.Symbol.unsafeCoerce` | Fallback référencé, notamment dans `Util.Type.Symbol`. L'intrinsèque PBO de `Unsafe.Coerce.unsafeCoerce` ne couvre pas ce nom différent. |
| `Effect.Now.now` | Requis directement avant/après chaque test ; fallback `unimplemented!()`. Le TAST donne `Effect Number` après dépliage des newtypes : fournir un effet différé retournant les millisecondes Unix, pas une lecture faite à sa construction. |
| `Effect.Now.getTimezoneOffset` | Aucun appel dans ce Rust, mais fallback conservé. Son portage n'est pas nécessaire au chronométrage ; ne pas le remplacer par un faux zéro. |
| `Record.Unsafe.unsafeSet` | Le PBO optimise certains labels littéraux, mais 15 lignes de références restent dans les instances de records (`Semiring`, `Semigroup`, etc.). Ce symbole manque réellement pour ces chemins ; ne pas le déclarer couvert par l'intrinsèque. |
| `Record.Unsafe.unsafeDelete` | Optimisation PBO partielle également ; aucun appel résiduel à ce nom dans ce graphe, fallback conservé. Candidat à suppression contrôlée. |
| `Test.Spec.Assertions.unsafeStringify` | Fallback chaîne vide utilisé par `AnyShow`. Les assertions b8x choisies utilisent leur `Show` typé et `fail`, pas `AnyShow`. Binding conservé à traiter, pas prérequis direct des quatre assertions. |
| `Test.Spec.Console.write` | Vrai manque sur le chemin du reporter console, fallback `unimplemented!()`. **Premier fichier à porter.** |
| `Test.Spec.Runner.exit` | Fallback encore référencé dans la branche `config.exit`. Le main fixe `exit = false`, donc cette branche n'est pas demandée ; il reste à traiter sa conservation sans interrompre les nettoyages Aff. |
| `Util.Html.Encode.Encode` : les deux fonctions | Deux fallbacks chaîne vide conservés. L'encodage est directement appelé par les assertions ; le wrapper de décodage reste généré. Les deux vrais contrats restent à porter. |

L'absence d'appel dynamique ne suffit pas à supprimer un problème de
compilation : les corps Rust conservés devront être typés. La génération
actuelle n'applique pas une élimination globale des fonctions depuis `main`.
Il reste donc à porter ou éliminer explicitement les bindings non nécessaires,
sans retirer de test actif. La présence des 39 autres `.rs` ne constitue pas
une validation de leurs signatures ou de toute leur sémantique.

Sources du classement : [`src/Main.purs`](src/Main.purs) pour les fallbacks,
[`Purust.CodeGen`](src/Purust/CodeGen.purs) pour les opérations bit à bit et
[`Semantics.Foreign`](../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/Semantics/Foreign.purs)
pour les règles PBO sur les bits, records et coercions.

**Contrat de la micro-étape Luna, `medium` : `Test.Spec.Console.write` seulement.**
Choix local fondé sur ce contrat borné, pas sur un benchmark b8x des modèles ;
la [documentation officielle Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
décrit son positionnement pour les tâches à coût maîtrisé.

- FFI à créer : `purust-spec/src/Test/Spec/Console.rs`, à côté du
  [`Console.purs`](../purust-spec/src/Test/Spec/Console.purs) existant.
- Signature native observée :
  `pub fn Test_Spec_Console_write(message: String) -> purust_core::UnknownType`.
  Ici `UnknownType` est le type `Value` du contrat d'effet existant, pas une
  absence de type dans le TAST (`String -> Effect Unit`).
- Réutiliser la convention de
  [`Effect/Console.rs`](../purust-console/src/Effect/Console.rs) : renvoyer
  `Value::Func1(Func1::Shared(Rc::new(...)))`, puis `Value::Unit` à l'exécution.
  Aucune écriture lors de la construction ; chaque exécution réécrit le texte.
  Le traitement `threadedRust` convertit le code vers `Arc` pour `--threaded`.
- Écrire exactement le texte sur stdout, sans préfixe, indentation ni saut de
  ligne ajouté. Convertir les chaînes purust avec
  `purust_string_to_utf8_lossy`, conserver ANSI et caractères Unicode, puis
  `write_all` et `flush` sous verrou stdout. Ignorer les erreurs d'écriture
  comme la FFI JS existante ; ne pas ajouter de dépendance Cargo.
- Ajouter uniquement le test natif ciblé
  `purust/tests/codegen/spec-console-ffi.mjs`, en reprenant le montage du
  runtime généré de [`effect-ffi.mjs`](tests/codegen/effect-ffi.mjs).
  Tester construction silencieuse, deux exécutions du même effet, chaîne
  vide, Unicode (dont paire et surrogate isolé), ANSI, absence de newline
  ajouté, retour `Unit` et stdout fermé. Vérifier les modes normal et
  `--threaded` via `threadedPrelude`/`threadedRust`.
- Commande de sortie prévue depuis `purust/purust` :
  `node --test tests/codegen/spec-console-ffi.mjs`. Le test doit compiler la
  vraie FFI avec `rustc`, exécuter les binaires et comparer les octets stdout.
  Contrôler aussi que le résolveur trouve le nouveau fichier et que la
  génération n'ajoute plus de fallback pour `Test_Spec_Console_write`.
- Arrêter après ce fichier, sa régression et le relevé de résultat. Ne pas
  porter Now, Lazy, l'encodage HTML ou modifier le générateur dans cette étape.
  Si le contrat d'effet existant ne suffit pas, revenir à Astra avec la trace.

### Micro-étape 0.4 — FFI console portée par Luna

Réalisée le 11 septembre 2026. Le fichier
[`Test/Spec/Console.rs`](../purust-spec/src/Test/Spec/Console.rs) implémente
`Test_Spec_Console_write` comme un effet différé rejouable : la construction
n'écrit rien, chaque exécution écrit le texte sur stdout sous verrou et
retourne `Unit`. Il utilise `purust_string_to_utf8_lossy`, `write_all` et
`flush`, sans nouvelle dépendance Cargo.

La régression
[`spec-console-ffi.mjs`](tests/codegen/spec-console-ffi.mjs) compile la vraie
FFI avec `rustc`, puis exécute les binaires normal et `--threaded`. Elle vérifie
la construction silencieuse, deux exécutions du même effet, chaîne vide, ANSI,
paire UTF-16 `🦀`, surrogate isolé converti en `�`, absence de newline ajouté,
retour `Unit` et absence de stderr.

Commande exécutée depuis `purust/purust` :

```sh
node --check tests/codegen/spec-console-ffi.mjs &&
node --test tests/codegen/spec-console-ffi.mjs
```

Résultat : **1 test passé**, code 0, en **0,95 s** ; les deux sous-processus
Rust, normal et threaded, ont réussi. Une génération diagnostique séparée
avec le TAST 0.2 a ensuite retrouvé
`/Users/0x1/Documents/htdocs/purust/purust-spec/src/Test/Spec/Console.rs` et
a produit la définition réelle `Test_Spec_Console_write`, sans fallback
`unimplemented!()`, avec sortie 0. Les sorties et le relevé sont conservés
dans [`qualify-i0901q`](../../b8x/run/bak/rust/output/qualify-i0901q).

Cette étape valide le contrat de cette FFI et son adaptation threaded ; elle
ne valide pas encore le runner Spec complet, `Effect.Now.now`, Cargo généré,
les codes d'échec de suite ou M1.

Le test initial ne contenait pas le scénario stdout fermé prévu dans le
contrat, ni un scénario séparé de construction sans exécution. Ces deux
vérifications sont ajoutées et exécutées en 0.5, sans changement de la FFI.

### Micro-étape 0.5 — Horloge native et premier blocage Cargo

Réalisée avec Astra le 11 septembre 2026.

[`purust-now/src/Effect/Now.rs`](../purust-now/src/Effect/Now.rs) fournit
`Effect_Now_now() -> purust_core::UnknownType`. Ce résultat est l'effet
`Value::Func1` attendu par le runtime ; son exécution lit `SystemTime::now`
et renvoie un `Value::Number` en millisecondes Unix entières. Le helper de
conversion traite aussi les dates antérieures à l'époque. Le TAST conserve
le contrat `Effect Number` après dépliage d'`Instant`/`Milliseconds`.
Aucune nouvelle dépendance Cargo ; chaque rejeu de l'effet relit l'horloge.
Il s'agit de l'horloge civile, qui peut être réglée par le système, pas d'une
garantie de monotonie.

`getTimezoneOffset` reste non porté : le graphe actuel ne l'appelle pas,
mais le générateur conserve son fallback `unimplemented!()`. Les wrappers
de conversion en date/heure et leurs FFI restent également à traiter.
La présence de `Now.rs` ne signifie donc pas que le package Now entier passe.

**Validation native :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
node --test tests/codegen/now-ffi.mjs tests/codegen/spec-console-ffi.mjs
```

Résultat : **3 tests passés**, zéro échec, sortie **0**, environ **1,37 s**
(Node 24.8.0, rustc/Cargo 1.96.0).

- [`now-ffi.mjs`](tests/codegen/now-ffi.mjs) : deux tests, normal et threaded,
  qui compilent la vraie FFI contre le runtime généré. Dates connues autour
  de l'époque, précision milliseconde, effet construit avant une attente,
  deux lectures espacées du même effet, composition avec les vrais
  `Effect_bindE`/`Effect_pureE`, horodatages encadrés par `Date.now()` côté
  Node, puis exécution depuis un autre thread en mode threaded.
- [`spec-console-ffi.mjs`](tests/codegen/spec-console-ffi.mjs) : régression
  complétée ; trois scénarios par mode sur cette machine Unix : construction
  seule silencieuse, sortie/rejeu comparés octet par octet, stdout fermé avec
  deux exécutions retournant `Unit`. Les cas UTF-16/ANSI restent vérifiés.
  Le scénario de fermeture utilise uniquement le descripteur stdout de son
  sous-processus de test ; il n'est pas exécuté sous Windows.

**Génération et état des fallbacks :**

Le diagnostic
[`now-pM1j0H/audit.mjs`](../../b8x/run/bak/rust/output/now-pM1j0H/audit.mjs)
a généré **211 modules**, sortie **0**, dans un dossier neuf. Son dossier
courant contient aussi `.purmeta` : aucun cache suivi du compilateur n'a
été modifié. Les empreintes des 211 sources PureScript du manifeste 0.2
sont inchangées ; ce TAST a été réutilisé pour le diagnostic. Le bundle
backend est le même que celui identifié en 0.3, non reconstruit ici.

Le résolveur trouve **41 fichiers FFI**, dont les deux nouveaux fichiers
Now/Console. Le Rust contient leur code réel intégral après `threadedRust`,
avec une seule définition de chaque symbole. L'inventaire recalculé donne
**27 fallbacks**, dont **18 encore référencés** et **9 sans référence hors
définition**, contre 29/20/9 avant les deux portages.

Preuves conservées dans ce dossier :
[`generation.json`](../../b8x/run/bak/rust/output/now-pM1j0H/generation.json)
(commandes, empreintes sources FFI, résolution, sorties),
[`symbols.json`](../../b8x/run/bak/rust/output/now-pM1j0H/symbols.json)
(symboles présents/manquants et références),
[`cargo-check.json`](../../b8x/run/bak/rust/output/now-pM1j0H/cargo-check.json)
(premier `cargo check --offline` du graphe complet).

**Blocage mesuré :** `cargo check` retourne **101**, avec quatre erreurs
`E0425` (type `crate::Exists` absent) et une erreur `E0057` (`runExists`
transmet deux arguments à la fonction unaire `Unsafe_Coerce_unsafeCoerce`).
La source `Data.Exists` déclare `foreign import data Exists`, puis définit
`mkExists` et `runExists` via `unsafeCoerce`. Son tableau TAST `foreign` est
vide : l'inventaire des valeurs étrangères ne couvre pas les types étrangers
ni tous les défauts de génération. Aucun test b8x n'a encore été exécuté.

Un reproducteur conserve uniquement les TAST originaux de `Data.Exists`
et `Unsafe.Coerce` :
[`reproduce-exists.mjs`](../../b8x/run/bak/rust/output/now-pM1j0H/reproduce-exists.mjs).
La génération de ces deux modules réussit, puis
`cargo check --offline --manifest-path rust/Cargo.toml -p Purs_Data_Exists`
reproduit les mêmes erreurs. Commandes et sorties exactes :
[`exists-AA4yCZ/commands.json`](../../b8x/run/bak/rust/output/now-pM1j0H/exists-AA4yCZ/commands.json).

**Contrat de la micro-étape suivante, réalisé en 0.6 — Astra :** résoudre ce reproducteur `Data.Exists` :
représentation du type étranger et arité de la coercion au rang 2, en
s'appuyant sur le TAST. Ajouter une régression native qui emballe une valeur
via `mkExists`, la consomme via `runExists` et vérifie le callback et son
résultat, y compris en threaded. Recompiler le backend après correction,
obtenir un `cargo check` réussi sur le reproducteur, puis relever le premier
blocage suivant du graphe complet. Ne pas remplacer le type manquant par
une struct vide ni supprimer ce module pour faire passer la compilation.

La suite du traitement des fallbacks dépend de ces preuves : conserver les
vraies FFI Now/Console, traiter séparément les types étrangers (Exists/Lazy),
puis porter les chemins requis ou éliminer les bindings non utilisés avec
une analyse d'accessibilité. `getTimezoneOffset`, les sept noms bit à bit
et `unsafeDelete` n'ont pas de référence résiduelle ici ; leurs définitions
fallback existent toujours et ne constituent pas une couverture native.
M1 reste incomplet.

### Micro-étape 0.6 — Data.Exists corrigé et validé en Rust

Réalisée avec Astra le 11 septembre 2026.

Deux corrections dans [`CodeGen.purs`](src/Purust/CodeGen.purs) :

- Le type qualifié `Data.Exists.Exists` utilise `UnknownType` (`Value`),
  c'est-à-dire son contenu existentiel, sans struct fictive ni allocation
  d'un conteneur supplémentaire. Cette règle ne s'applique pas à tous les
  types étrangers ; les autres types et layouts TAST restent inchangés.
- Une annotation de fonction sur une référence globale conserve son type
  TAST instancié, même si son arité diffère de celle de la déclaration
  polymorphe. L'adaptateur d'arité existant applique alors `unsafeCoerce` au
  callback, puis le callback au contenu. La FFI unaire `unsafeCoerce` reste
  inchangée ; les gardes des annotations obsolètes sur les autres formes
  d'expressions sont conservées.

La régression [`exists.mjs`](tests/tast/exists.mjs) compile un TAST neuf depuis
le vrai `Data.Exists` du package `exists-6.0.0` présent dans le cache Spago du
compilateur et depuis `purust-unsafe-coerce/src/Unsafe/Coerce.purs`. Elle ne
réécrit ni la bibliothèque ni ses annotations. Avant correction, elle échouait
sur la référence Rust au type `crate::Exists` absent.

Après reconstruction du backend, les exports générés passent les vérifications
natives en modes normal et `--threaded` : emballage et lecture de nombres et
chaînes, callback capturant un compteur appelé une fois par lecture, identité
d'un tableau partagé, identité d'une closure capturée rendue sans exécution
anticipée, puis transfert du contenu et lecture depuis un autre thread.

**Reconstruction et non-régression :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/spago bundle --offline --module Main --platform node --outfile bin/purust.js --bundle-type app
node --test --test-concurrency=2 tests/codegen/*.mjs
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs node --test --test-concurrency=2 tests/tast/*.mjs
```

Build et bundle : sortie **0**, zéro erreur, **75 avertissements** au build
complet (non traités dans cette micro-étape). Le bundle suivi
[`bin/purust.js`](bin/purust.js) a été reconstruit, SHA-256 :
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
Tests : **45/45 codegen** (~11,24 s) et **17/17 TAST** (~77,46 s), zéro échec.
La nouvelle régression fait partie des 17 tests TAST ; elle couvre les deux
modes, et non deux tests Node distincts.

**Vérification du graphe b8x :**

`node prepare.mjs` a recompilé les **211 modules** dans
[`prepare-L2x9hL`](../../b8x/run/bak/rust/output/prepare-L2x9hL/manifest.json).
Le manifeste et `commands.json` identifient les sources et le binaire TAST du
fork local ; les réserves sur sa provenance décrites en 0.2 restent valables.
Le diagnostic neuf
[`exists-fixed-YU9nh0/audit.mjs`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/audit.mjs)
utilise ce TAST et le nouveau bundle, avec son propre dossier courant pour
`.purmeta`, sans réécrire les diagnostics antérieurs ni les caches suivis.

- Reproducteur à deux modules, threaded : génération réussie et
  `cargo check --offline --manifest-path minimal-rust/Cargo.toml -p Purs_Data_Exists`
  réussi, sortie **0**. Commandes et sorties :
  [`minimal-check.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/minimal-check.json).
- Graphe complet : génération **211 modules**, sortie **0** ; **41 fichiers
  FFI**, **27 fallbacks**, dont **18 référencés** et **9 sans référence hors
  définition**, inchangés. Now et Console restent de vraies FFI.
  Preuves : [`generation.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/generation.json)
  et [`symbols.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/symbols.json).
- Cargo complet : sortie **101**, **21 erreurs `E0603`** dans
  `Purs_Control_Monad_List_Trans`, sur `Purs_Data_Lazy::Lazy` déclaré privé.
  [`cargo-check.json`](../../b8x/run/bak/rust/output/exists-fixed-YU9nh0/cargo-check.json)
  conserve le diagnostic complet. Aucun test b8x exécuté en Rust ; M1 reste
  incomplet.

**Contrat repris et réalisé en 0.7 — Astra :** isoler `Data.Lazy` avec un consommateur
minimal et définir son contrat de représentation/mémorisation natif.
Le type étranger `Data.Lazy.Lazy` n'est pas implémenté : dans le Rust actuel,
le nom `Lazy` est fourni par l'import privé de la classe `Control.Lazy.Lazy`,
qui est un dictionnaire différent. La suggestion de rustc d'importer ce
dictionnaire directement ne corrige donc pas la représentation du contenu
différé. Les fallbacks `Data_Lazy_defer` et `Data_Lazy_force` restent présents.
Fixer une régression : aucune évaluation à la construction, une seule au
premier `force`, résultat partagé aux lectures suivantes ; préciser aussi
le comportement threaded et en cas de panic. Le portage de cette
représentation et de ses deux opérations suivra ce contrat, sans étendre
l'étape aux autres FFI. Luna attend un contrat d'implémentation borné.

### Micro-étape 0.7 — Data.Lazy isolé ; contrat natif fixé

Réalisée avec Astra le 11 septembre 2026. Diagnostic et contrat uniquement :
aucune modification du générateur, du runtime ou d'une FFI dans cette étape.

**Reproducteur empirique :**

Le consommateur [`LazyProbe.purs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/LazyProbe.purs)
contient trois fonctions : construire un `Lazy Int`, le forcer, et conserver
son identité. Il importe le vrai `purust-lazy/src/Data/Lazy.purs` sans le
réécrire. [`reproduce.mjs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/reproduce.mjs)
sélectionne sa fermeture avec `purs graph`, compile un TAST neuf, génère le
Rust et lance Cargo séparément en normal et threaded. Résultat : **77 modules**
(le consommateur et 76 dépendances), sans Spec/Aff ni application b8x ;
**5 erreurs `E0603` dans chaque mode**, sortie Cargo **101**, sur le type
`Purs_Data_Lazy::Lazy` privé. Le script termine à 0 parce qu'il vérifie
explicitement cet échec attendu ; ce n'est pas une validation native réussie.

Preuves : [`commands.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/commands.json)
et [`reproduction.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/reproduction.json)
(sources et empreintes, annotations étrangères TAST, layout du dictionnaire,
signatures et erreurs). Bundle inchangé depuis 0.6 :
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
Le diagnostic utilise son propre `.purmeta` et refuse de réutiliser son TAST
déjà généré : reprendre les scripts dans un dossier neuf pour une autre mesure.

Le TAST distingue correctement les deux types : `Data.Lazy` ne définit aucun
layout ADT/classe et déclare le type étranger `Lazy` ; `Control.Lazy` définit
la classe `Lazy` avec son champ `defer`. Le Rust de `Data_Lazy_lazyLazy`
retourne déjà `Rc<Purs_Control_Lazy::Lazy>` (ou `Arc`) ; les opérations sur
le contenu différé attendent `Rc<Purs_Data_Lazy::Lazy>` (ou `Arc`). Le portage
doit fournir ce dernier type, pas réexporter le dictionnaire homonyme.

**Sémantique JS mesurée :**

[`probe-js.mjs`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/probe-js.mjs)
importe directement la vraie FFI locale `purust-lazy/src/Data/Lazy.js`.
**5 vérifications passées**, sortie 0 : construction/alias sans évaluation,
résultat partagé après succès, fonction retournée sans exécution anticipée,
`Lazy` imbriqué non forcé automatiquement, exception propagée puis nouvel
essai, exceptions répétées sans valeur de remplacement. Les deux premiers
points sont regroupés dans un même scénario ; voir
[`js-contract.json`](../../b8x/run/bak/rust/output/lazy-contract-PbXoft/js-contract.json).
La nuance de contrat est importante : **un résultat réussi est mémorisé ;
une tentative qui lève une exception ne l'est pas**.

**Représentation et ABI retenues pour le portage :**

- Ajouter uniquement `purust-lazy/src/Data/Lazy.rs` et ses régressions.
  Définir `pub struct Lazy` avec un état privé partagé, distinct du dictionnaire
  `Control.Lazy.Lazy`. Garder la représentation native déjà émise : `Rc<Lazy>`
  en normal, transformée en `Arc<Lazy>` par `threadedRust`. Cloner le handle
  partage la cellule et ne copie pas l'état de mémorisation.
- Signatures normales observées, à respecter :
  `Data_Lazy_defer(thunk: purust_core::Func1<(), crate::UnknownType>) -> Rc<Lazy>`
  et `Data_Lazy_force(value: Rc<Lazy>) -> crate::UnknownType`.
  `defer` ne calcule rien ; `force` appelle le callback avec `()` et retourne
  directement la valeur mémorisée. Ce ne sont pas des wrappers `Effect`.
- Le résultat polymorphe utilise `Value` comme les autres FFI génériques ;
  les sites d'appel gardent leurs types TAST (le consommateur retourne `i64`).
  Les conversions existantes via `Value::Class` doivent conserver le handle.
  Ne pas assimiler ce type à `Value::Thunk` : ce dernier sert aux valeurs
  récursives déjà initialisées et `resolve()` attend une valeur disponible,
  sans callback à évaluer. Aucun nouveau variant du runtime n'est requis
  par le contrat retenu.

**Mémorisation, concurrence et erreurs — décisions natives à implémenter :**

- États : en attente avec callback, en cours avec propriétaire, prêt avec
  résultat. Choix initial : `Mutex` + `Condvar` de la bibliothèque standard,
  utilisables dans les deux modes. Conserver `Func1` et le traitement Rc/Arc
  existants ; pas de `unsafe impl Send/Sync` ni de dépendance Cargo ajoutée.
- Une seule tentative à la fois par cellule. En threaded, les autres lecteurs
  attendent puis obtiennent le même résultat partagé ; ne jamais conserver
  le verrou pendant l'exécution du callback. Après réussite, libérer les
  captures du callback devenues inutiles. Les lectures renvoient un clone
  de `Value`, sans recalcul ni copie profonde des contenus partagés.
- Si le callback panique en mode unwind, propager le panic d'origine au
  lecteur concerné, remettre la cellule en attente avec son callback, puis
  réveiller les lecteurs. Un lecteur suivant peut réessayer ; ne publier ni
  `Unit` par défaut, ni erreur en cache, ni état définitivement empoisonné.
  Prévoir un garde de restauration RAII ; ne pas exécuter le callback sous
  le verrou. Avec `panic=abort`, le processus s'arrête normalement.
- Un `force` réentrant sur la même cellule dans le thread évaluateur doit
  échouer explicitement (`Data.Lazy.force: reentrant evaluation`) plutôt
  qu'attendre son propre résultat. C'est un choix de diagnostic natif, pas
  une garantie issue de la FFI JS. Les dépendances imbriquées acycliques et
  les structures paresseuses productives restent permises. La détection
  générale des cycles de dépendances entre plusieurs threads est hors de
  cette première implémentation ; ne pas promettre leur prise en charge.
- Forcer un `Lazy` contenant une fonction, un effet ou un autre `Lazy`
  retourne ce contenu sans l'exécuter ni le forcer récursivement. Un effet
  ainsi retourné reste rejouable à chaque appel explicite.

**Contrat réalisé en 0.8 — Astra :** réaliser ce portage et une régression native
sur la vraie FFI. Le contrat est défini, mais la première implémentation de
l'état partagé, du réveil après panic et de la réentrance reste un travail
de sémantique/concurrence ; Luna pourra ensuite étendre mécaniquement les cas.

- [x] Tester normal/threaded : compteur à 0 après `defer` et copie du handle,
  puis 1 après plusieurs `force` ; identité du résultat partagé et des
  fonctions, absence d'exécution anticipée, libération des captures après
  succès et des valeurs à la destruction des derniers handles (cas acycliques).
- [x] Tester tentative qui panique puis réussit, échecs répétés, réentrance
  bornée et forcing d'une autre cellule. En threaded, tester des lecteurs
  simultanés avec une barrière, une seule évaluation réussie et des lecteurs
  réveillés après un panic. Mettre un timeout sur ces sous-processus pour
  rendre un deadlock observable.
- [x] Ajouter une régression TAST normale/threaded avec le vrai consommateur
  et vérifier aussi le dictionnaire `Data_Lazy_lazyLazy`, sans confusion avec
  le type du contenu. Refaire Cargo sur les 77 modules, attendu 0.
- [x] Régénérer le graphe b8x dans un dossier neuf et vérifier la résolution
  des deux vrais symboles, sans fallback. Si seuls ces deux symboles changent,
  l'inventaire attendu est 25 fallbacks dont 16 référencés, à mesurer et non
  à présumer. Relever le prochain blocage puis s'arrêter.

M1 reste incomplet : ce diagnostic n'a ni exécuté une spec b8x en Rust, ni
validé une implémentation native de `Data.Lazy`. Les 62 régressions de 0.6
n'ont pas été relancées : aucun code de production n'a changé ici.

### Micro-étape 0.8 — FFI Data.Lazy implémentée et validée

Réalisée avec Astra le 11 septembre 2026.

[`purust-lazy/src/Data/Lazy.rs`](../purust-lazy/src/Data/Lazy.rs) fournit le
type étranger `Lazy`, `Data_Lazy_defer` et `Data_Lazy_force`, avec les signatures
natives prévues en 0.7. La cellule utilise `Mutex`/`Condvar`, sans dépendance
ajoutée ni `unsafe`. Son handle `Rc` devient `Arc` en threaded. Le callback
est déplacé hors du verrou pendant l'évaluation ; le succès publie le résultat
et libère les captures, tandis qu'un garde RAII restaure le callback et
réveille les lecteurs lors d'un panic. Le payload du panic est conservé.
La réentrance dans le thread évaluateur produit le diagnostic convenu.

Aucun changement du générateur, du runtime, de PBO ou du bundle dans cette
micro-étape. Le bundle reste celui de 0.6, SHA-256
`d708da95656502e71c128fab75ddd1d49b0ba7206c16423bee38877feaedf46f`.
SHA-256 de la nouvelle FFI après formatage :
`ad0ee57acc45e594b7e096dbecb9d86be4c108255c25c84bcee01d49daee161f`.
Les limites du contrat 0.7 subsistent : cycles interthreads non détectés,
pas de récupération avec `panic=abort`, tests de libération sur cas acycliques.

**Régressions natives :**

- [`lazy-ffi.mjs`](tests/codegen/lazy-ffi.mjs) compile la vraie FFI contre le
  runtime généré, puis exécute [`lazy-ffi.rs`](tests/codegen/fixtures/lazy-ffi.rs).
  Deux tests Node, normal/threaded ; respectivement 8 et 10 scénarios Lazy
  (le harnais exécute aussi 4 tests du runtime en normal). Construction et
  aliases sans calcul, résultat partagé, aller-retour via `Value::Class`,
  libération des captures et des derniers résultats, destruction sans force,
  fonctions/effets renvoyés sans exécution, lazy imbriqué, panic inchangé puis
  retry, échecs répétés, réentrance et forcing d'une autre cellule.
  Un callback peut aussi intercepter son propre échec de réentrance puis
  publier un résultat valide.
- En threaded : `Lazy: Send + Sync` vérifié par rustc ; 8 lecteurs concurrents
  face à un premier évaluateur bloqué, résultat partagé après succès ; même
  scénario avec panic du premier lecteur, puis réveil et un seul retry réussi.
  Chaque scénario concurrent est répété 8 fois. Les sous-processus ont des
  délais maximaux pour rendre un deadlock observable.
- [`tests/tast/lazy.mjs`](tests/tast/lazy.mjs) compile le vrai module et le
  consommateur [`LazyProbe.purs`](tests/tast/fixtures/lazy/LazyProbe.purs).
  Les dépendances sont résolues depuis le lockfile/cache du compilateur et
  les sources natives locales, sans dépendre d'un diagnostic b8x antérieur.
  La fermeture compilée reste de **77 modules**. Dans les deux modes : vraie
  FFI intégrale trouvée dans le Rust, une seule définition de chaque symbole,
  aucun fallback à leur place, **Cargo check réussi**. Les tests Cargo passent :
  2 en normal, 3 en threaded. Ils couvrent l'identité et la lecture de la
  cellule depuis PureScript, le dictionnaire distinct `Data_Lazy_lazyLazy`
  et le transfert de la valeur générée entre threads.

Commande de non-régression exécutée depuis `purust/purust` :

```sh
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_LAZY_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/lazy-fixed-1zpVDj node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**65 tests Node passés**, zéro échec, sortie **0**, environ **104,32 s**
(47 codegen et 18 TAST). L'option de conservation est facultative : sans elle,
le test Lazy supprime uniquement son propre dossier temporaire. Preuves du
dernier test Lazy, après formatage :
[`commands.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/purust-lazy-tast-MZ9YZq/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/purust-lazy-tast-MZ9YZq/provenance.json).

**Intégration b8x et prochain blocage mesuré :**

`node prepare.mjs` a régénéré **211 modules TAST** dans
[`prepare-QlQ5st`](../../b8x/run/bak/rust/output/prepare-QlQ5st/manifest.json).
Le diagnostic neuf [`lazy-fixed-1zpVDj/audit.mjs`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/audit.mjs)
a généré les 211 modules Rust, sortie **0**, avec son propre `.purmeta`.
L'inventaire mesure **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Now et Console restent de vraies FFI ;
`Data_Lazy_defer` et `Data_Lazy_force` le sont désormais aussi. Empreintes et
résolution : [`generation.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/generation.json) ;
références : [`symbols.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/symbols.json).
La FFI testée et la FFI utilisée par b8x ont la même empreinte.

Cargo complet retourne **101**, maintenant sur `Purs_Effect_Aff_Class` :
**9 erreurs `E0308`** (`Value` attendu, `Arc<MonadAff>` produit) et
**9 erreurs `E0609`** (champs `liftAff`/`MonadEffect0` lus sur un `Value`).
Premier exemple : `Effect_Aff_Class_monadAffAff`, ligne 142 du Rust généré.
Le TAST frais contient bien `classDecls.MonadAff`, sa méthode `liftAff` et
sa superclasse `Effect.Class.MonadEffect` : il ne manque pas ce layout.
Diagnostic complet : [`cargo-check.json`](../../b8x/run/bak/rust/output/lazy-fixed-1zpVDj/cargo-check.json).

**Contrat réalisé en 0.9 — Astra :** isoler et corriger la représentation du
dictionnaire `Effect.Aff.Class.MonadAff`, en vérifiant notamment la règle
générale qui classe les types des modules `Effect_Aff*` comme `UnknownType`.
Préserver l'ABI des valeurs Aff tout en utilisant le layout TAST de la classe.
Ajouter une régression native normale/threaded pour la construction du
dictionnaire, `liftAff` et la projection de superclasse, puis relancer b8x et
relever le blocage suivant. Ne pas modifier la FFI Aff pour masquer un défaut
de représentation de dictionnaire. Luna intervient après validation du
premier correctif sémantique, pour des extensions de tests précisément bornées.

M1 reste incomplet : aucune spec b8x exécutée en Rust à ce stade.

### Micro-étape 0.9 — Dictionnaire MonadAff natif corrigé

Réalisée avec Astra le 11 septembre 2026.

La règle de [`CodeGen.purs`](src/Purust/CodeGen.purs) qui traitait tous les
modules préfixés `Effect_Aff` comme `UnknownType` englobait à tort la classe
`Effect.Aff.Class.MonadAff`. Elle est remplacée par les noms exacts des modules
de runtime déjà opaques : `Effect.Aff`, `Effect.Aff.AVar` et `Effect.Aff.Compat`.
La classe retrouve ainsi sa représentation native fournie par le layout TAST,
sans changer l'ABI des valeurs Aff ni celle de leurs wrappers.

Avant correction, la nouvelle régression obtenait `crate::UnknownType` au
lieu de `Rc<crate::MonadAff>` et échouait. Après correction, le Rust de b8x
déclare `Effect_Aff_Class_monadAffAff() -> Arc<crate::MonadAff>` et le premier
argument de `Effect_Aff_Class_liftAff` est ce dictionnaire natif. Les 18 erreurs
`E0308`/`E0609` précédentes ne sont plus le blocage Cargo.

**Validation :**

- [`tests/codegen/aff-class.mjs`](tests/codegen/aff-class.mjs) : test de
  représentation et régression Rust en **normal et threaded**. Construction
  native du dictionnaire, capture et identité de la superclasse, méthode
  `liftAff`, conservation d'un contenu opaque et absence d'exécution anticipée
  d'une fonction rejouable. Les représentations opaques Aff/ParAff/Supervisor,
  Fiber/Canceler/FFIUtil et des wrappers Compat sont vérifiées, ainsi que la
  représentation native inchangée d'`Effect.AVar.AVar`.
- [`tests/tast/aff-class.mjs`](tests/tast/aff-class.mjs) : le vrai
  `purust-aff/src/Effect/Aff/Class.purs`, ses instances et le consommateur
  [`AffClassProbe.purs`](tests/tast/fixtures/aff-class/AffClassProbe.purs) passent
  par **120 modules TAST frais**, puis par le nouveau backend et Cargo.
  `cargo check` et `cargo test` retournent **0**. Le test Rust utilise la vraie
  FFI Aff et son exécuteur : `viaAff` conserve l'identité du descripteur natif,
  `viaEffect` projette la superclasse, et quatre exécutions explicites sont
  comptées, sans aucune exécution lors de la construction ou du lifting.
  Cette régression sur l'exécuteur Aff est **threaded** ; le mode normal est
  couvert pour la représentation des dictionnaires, pas pour l'exécuteur Aff.
- Aucun changement de la FFI Aff ni de PBO. L'empreinte de la FFI Aff est
  identique à celle du diagnostic 0.8 et à celle utilisée par le test :
  `f7a382756ef00bbdb4c61f20f936685016b0ce5a3b1aefb20fbb8e6eacfbcf62`.

**Reconstruction et non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PATH="$PWD/node_modules/.bin:$PATH" ./node_modules/.bin/spago bundle --offline --module Main --platform node --outfile bin/purust.js --bundle-type app
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_AFF_CLASS_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/monadaff-fixed-m5tgGr node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

Build/bundle : sortie **0**, zéro erreur, **65 avertissements** lors de cette
recompilation incrémentale, non traités ici. Nouveau bundle suivi, SHA-256 :
`9956b4910d75e5e2f9931ccd0b154d0f4e3236673e1ee32d622189bfc3443b3c`.
**67 tests Node passés** (48 codegen et 19 TAST), zéro échec, sortie **0**,
environ **113,37 s**. L'option de conservation des résultats Aff est facultative.
Preuves du dernier test TAST :
[`commands.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/purust-aff-class-tast-0cjYSl/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/purust-aff-class-tast-0cjYSl/provenance.json).

**Graphe b8x :**

`node prepare.mjs` a recompilé les **211 modules** dans
[`prepare-g4cpfC`](../../b8x/run/bak/rust/output/prepare-g4cpfC/manifest.json).
Le diagnostic neuf [`monadaff-fixed-m5tgGr/audit.mjs`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/audit.mjs)
a généré les 211 modules Rust, sortie **0**, avec un `.purmeta` isolé.
Inventaire inchangé : **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Now, Console et Lazy restent les
vraies FFI. Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/monadaff-fixed-m5tgGr/cargo-check.json).

Cargo retourne **101** sur le blocage suivant : **8 erreurs `E0308`** dans
`Purs_Control_Monad_Free`, fonction `Control_Monad_Free_freeMonadRec`.
Aux lignes 423–435 du Rust produit, des tests/projections des constructeurs
`Control.Monad.Rec.Class.Step.Loop` et `Done` sont appliqués à un `&Val`.
Le commentaire généré montre lui-même l'écart : annotation `Rc<Step>`,
expression locale `Rc<Val>`. Ce relevé ne tranche pas encore entre une
annotation obsolète, une instanciation mal propagée et une conversion absente.

**Baby step suivant, réalisé en 0.10 — Astra :** isoler `freeMonadRec` et corriger cette
confusion `Val`/`Step` à partir du TAST et d'un reproducteur exécuté.
Préserver les deux layouts et les sémantiques de `Loop`/`Done`, sans cast
non vérifié ni effacement global des types. Ajouter une régression native
normale/threaded qui exerce les deux branches, vérifier Cargo sur le
reproducteur, puis relancer b8x et relever le blocage suivant. Ne pas étendre
ce correctif aux FFI restantes. Luna pourra étendre les cas après validation
du premier correctif sémantique.

M1 reste incomplet : les régressions isolées passent, mais aucune spec b8x
n'a encore été exécutée en Rust.

### Micro-étape 0.10 — Frontière existentielle de freeMonadRec corrigée

Réalisée le 11 septembre 2026.

Le reproducteur [`tests/tast/free-monad-rec.mjs`](tests/tast/free-monad-rec.mjs)
compile le vrai package `free-7.1.0` et un consommateur, soit **91 modules TAST
frais**. Avant correction, il reproduit les **8 erreurs `E0308`** `Val`/`Step`
de b8x, sortie Cargo **101**. Le TAST associe bien `Step a b` au paramètre de
la continuation de `freeMonadRec`. Dans la source, `freeBind` conserve cette
continuation via `unsafeCoerceBind :: (a -> Free f b) -> Val -> Free f Val`.
`dataDecls.Val` n'a aucun constructeur : `Val` sert de conteneur existentiel,
pas de valeur d'un enum habité que Rust pourrait construire.

Le backend représentait ce conteneur par `Rc<Val>`/`Arc<Val>` et tentait de
tester/projeter `Loop` et `Done` directement dessus. La correction dans
[`CodeGen.purs`](src/Purust/CodeGen.purs) représente **uniquement
`Control.Monad.Free.Val` par `Value`**. Les conversions existantes récupèrent
alors le vrai `Rc<Step>`/`Arc<Step>` par un downcast vérifié. `Free`, `FreeView`
et `Step` gardent leurs layouts natifs ; aucune modification de leurs
déclarations TAST, de PBO, des sources du package `free`, ni des FFI.
Les types `Val` d'autres modules ne sont pas concernés.

**Régressions :**

- [`tests/codegen/free-val.mjs`](tests/codegen/free-val.mjs) verrouille la
  portée exacte de la représentation et les layouts natifs conservés.
- Le test TAST vérifie le `Val` sans constructeur, l'absence de référence
  native à `Val` et la présence de la conversion vérifiée vers `Step`.
  `cargo check` et `cargo test` passent en **normal et threaded**.
- **5 tests Rust par mode** : `Loop`/`Done` avec zéro, une et plusieurs
  itérations (jusqu'à 1000), chemins purs et suspendus ; identité d'un tableau
  et rejeu d'un `Free` partagé ; compte exact des continuations et résultat
  final d'un autre type ; retour d'une fonction sans exécution anticipée,
  identité et rejeu ; rejet d'un payload natif incorrect à la frontière `Step`.
  Le compteur observe aussi la construction immédiate de `k(seed)`, conforme
  à l'implémentation, sans la confondre avec les continuations différées.

**Reconstruction :** même commande `spago bundle --offline` qu'en 0.9,
sortie **0**, zéro erreur et **65 avertissements** lors du build incrémental,
non traités ici. Bundle suivi, SHA-256 :
`942d1ac450b63a19d68378f18a50a9891fdadd742f50d4dd5c0d66cae3212a93`.

**Non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_FREE_MONAD_REC_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**69 tests Node passés** (49 codegen, 20 TAST), zéro échec, sortie **0**,
environ **134,19 s**. Ce sont des régressions du compilateur/runtime, pas des
tests b8x. Preuves du test TAST Free :
[`commands.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/purust-free-monad-rec-tast-fISwXs/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/purust-free-monad-rec-tast-fISwXs/provenance.json).
L'empreinte du bundle y est identique à celle du diagnostic b8x.
`git diff --check`, les vérifications de syntaxe Node et `rustfmt --check`
sur les nouveaux tests passent aussi.

**Graphe b8x :**

Préparation neuve de **211 modules** :
[`prepare-10Rtjb/manifest.json`](../../b8x/run/bak/rust/output/prepare-10Rtjb/manifest.json).
Génération diagnostique **0**, `.purmeta` isolé :
[`free-monad-rec-fixed-yK3WWL/audit.mjs`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/audit.mjs).
Inventaire inchangé : **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**
et **9 sans référence hors définition**. Cargo franchit `Control.Monad.Free`
et retourne **101** sur **3 erreurs `E0425`** dans `Purs_Pipes_Internal` :
`crate::X` absent, aux lignes 173 (`Pipes_Internal_X`) et 609
(`Pipes_Internal_closed`) du Rust produit. La source contient
`newtype X = X X` ; aucun layout `dataDecls.X` n'est présent. Ce constat
n'est pas encore un diagnostic complet de la représentation de ce newtype.

Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/free-monad-rec-fixed-yK3WWL/cargo-check.json).

**Baby step suivant, réalisé en 0.11 — Astra :** isoler le newtype récursif `Pipes.Internal.X`
et `closed`, déterminer leur représentation à partir du TAST et corriger la
génération sans fabriquer une valeur de ce type impossible ni généraliser
l'effacement des ADT. Vérifier le reproducteur en normal/threaded, puis le
graphe b8x et relever le blocage suivant. Ne pas porter d'autres FFI dans ce
correctif. Luna pourra étendre les cas après validation du choix sémantique.

M1 reste incomplet : aucun test b8x n'a encore été exécuté en Rust.

### Micro-étape 0.11 — Pipes.Internal.X corrigé, premier cargo check b8x réussi

Réalisée le 11 septembre 2026.

Le TAST frais de `pipes-8.0.0/src/Pipes/Internal.purs` décrit le constructeur
`X` avec la métadonnée `IsNewtype`, une abstraction identité et la signature
`X -> X`. Aucun `dataDecls.X` n'est présent. La source est bien
`newtype X = X X`, suivie de `closed (X x) = closed x` : ce type récursif
n'a pas de valeur finie constructible. Le backend demandait pourtant
`Rc<crate::X>`/`Arc<crate::X>`, sans déclaration native correspondante.

La règle dans [`CodeGen.purs`](src/Purust/CodeGen.purs) associe le nom qualifié
**`Pipes.Internal.X` à `purust_core::Void`**, l'enum vide déjà fourni par le
runtime. `X` reste une fonction identité `Void -> Void` ; `closed` conserve
sa boucle et son argument de type vide. Aucun `Value`, faux constructeur ou
cast non vérifié ne permet de fabriquer un `X`. `Proxy` reste natif et les
autres types nommés `X` sont inchangés. Cette règle est limitée à ce contrat
de bibliothèque, pas une détection générale des newtypes récursifs.
Aucun changement de PBO, des sources de `pipes` ni des FFI.

**Reproducteur et validation :**

- [`tests/tast/fixtures/pipes-x/Pipes/Internal.purs`](tests/tast/fixtures/pipes-x/Pipes/Internal.purs)
  reprend uniquement les déclarations `X`/`closed` du package. Avec son
  consommateur et la vraie FFI `Unsafe.Coerce`, il forme un reproducteur de
  **3 modules TAST frais**, distinct du graphe réel b8x.
- Avant correction, ce reproducteur donne les mêmes **3 erreurs `E0425`**
  que b8x, sortie Cargo **101**. Après correction, `cargo check` et
  `cargo test` passent en **normal et threaded**.
- **5 tests Rust par mode** : signatures natives et preuve d'inhabitation
  impossible par `match value {}` ; transport de `closed` et de callbacks
  sans exécution, résultat et identité conservés ; rejet d'un faux `X`
  produit par `unsafeCoerce` ; rejet d'un argument invalide avant l'entrée
  dans la boucle d'un `closed` boxé ; ADT homonyme et newtype ordinaire natifs.
- [`tests/codegen/pipes-x.mjs`](tests/codegen/pipes-x.mjs) verrouille le nom
  qualifié, la représentation `Void` inchangée et celle de `Proxy` et des
  types `X` voisins. [`tests/tast/pipes-x.mjs`](tests/tast/pipes-x.mjs)
  vérifie aussi les métadonnées du TAST, pas seulement le Rust généré.

**Reconstruction :** même commande `spago bundle --offline` qu'en 0.9,
sortie **0**, zéro erreur et **65 avertissements** lors du build incrémental,
non traités ici. Bundle suivi, SHA-256 :
`8fb49f42b6cd1b4f94628659bc70e89e120bd67870660c01780d5400b2b68d79`.

**Non-régression complète :**

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs PURUST_PIPES_X_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

**71 tests Node passés** (50 codegen, 21 TAST), zéro échec, sortie **0**,
environ **141,05 s**. Ce sont les régressions compilateur/runtime, pas les
specs b8x. Preuves du test minimal :
[`commands.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/purust-pipes-x-tast-6tN6pe/commands.json)
et [`provenance.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/purust-pipes-x-tast-6tN6pe/provenance.json).
L'empreinte du bundle est identique dans ce test et le diagnostic b8x.
`git diff --check`, les vérifications de syntaxe Node et `rustfmt --check`
des nouveaux tests passent également.

**Graphe réel b8x :**

[`prepare-nPjDfC/manifest.json`](../../b8x/run/bak/rust/output/prepare-nPjDfC/manifest.json)
consigne **211 modules TAST frais**, dont le vrai `Pipes.Internal` inchangé.
Le diagnostic neuf
[`pipes-x-fixed-OtEWpV/audit.mjs`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/audit.mjs)
génère les 211 modules Rust avec un `.purmeta` isolé, sortie **0**.
Leurs signatures `X`/`closed` utilisent bien `purust_core::Void` et le
`cargo check --offline` du workspace complet retourne désormais **0**,
environ **11,68 s**. Aucun nouveau blocage de typage n'est détecté.

Inventaire FFI inchangé : **42 fichiers**, **25 fallbacks**, dont
**16 référencés** et **9 sans référence hors définition**. Ils empêchent de
conclure au support d'exécution ; leur présence ne prouve pas non plus
qu'ils seront tous atteints par ce test. Aucun binaire b8x n'a été lancé.
Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/pipes-x-fixed-OtEWpV/cargo-check.json).

**Baby step suivant, réalisé en 0.12 — Astra :** construire puis lancer le profil minimal
b8x en diagnostic borné, avec stdout/stderr, code de sortie et backtrace
conservés. Utiliser un diagnostic neuf et des sources/bundle identifiés.
Relever le premier blocage de build ou d'exécution réellement observé
(fallback FFI, runtime ou génération), l'isoler si nécessaire, puis définir
le correctif suivant. Ne pas porter plusieurs FFI à l'aveugle ni compter
une exécution interrompue comme une spec passée. Luna pourra porter les
cas répétitifs une fois le contrat correspondant validé.

M1 reste incomplet : `cargo check` passe, mais aucun test b8x n'a encore été
exécuté en Rust, et les fixtures positive/négative restent à valider.

### Micro-étape 0.12 — Premier lancement b8x et blocage réel du résumé

Réalisée le 11 septembre 2026. Diagnostic uniquement : aucun correctif du
compilateur, du runtime ou des FFI n'a été appliqué pendant cette étape.

**Préparation et provenance :**

- [`prepare-EjHcws/manifest.json`](../../b8x/run/bak/rust/output/prepare-EjHcws/manifest.json) :
  **211 modules TAST frais**, point d'entrée et specs inchangés.
- Diagnostic neuf, génération et `cargo check` réussis :
  [`first-execution-Kk5IGG/audit.mjs`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/audit.mjs).
  **42 fichiers FFI**, **25 fallbacks**, dont **16 référencés**, inchangés.
- Bundle identique à celui de 0.11, SHA-256 :
  `8fb49f42b6cd1b4f94628659bc70e89e120bd67870660c01780d5400b2b68d79`.
  Les empreintes des sources, des FFI, de **431 fichiers natifs/manifests**
  et du binaire sont conservées et revérifiées après l'exécution.
- `.purmeta`, Cargo et binaire restent dans ce nouveau diagnostic ; les
  profils/liens JS existants sont inchangés. Aucune intégration externe
  n'est ajoutée au graphe sélectionné.

**Build et lancement :**

```sh
cd /Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/first-execution-Kk5IGG
node audit.mjs
node build-run.mjs
```

Ces scripts refusent d'écraser un diagnostic déjà réalisé : pour répéter,
créer un nouveau dossier et sélectionner un manifeste de préparation neuf.
[`build-run.mjs`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/build-run.mjs)
exécute un `cargo build --offline -p purust_output --bin purust_output`
avec cible Cargo explicitement isolée, puis le binaire debug avec
`RUST_BACKTRACE=full`. Bornes : **60 s** pour le build, **15 s** pour le
lancement ; arrêt du groupe de processus en cas de dépassement.

- Build et édition de liens : sortie **0**, environ **15,20 s**.
- Binaire lancé : sortie **101**, environ **0,54 s**, sans timeout ni signal.
- SHA-256 du binaire :
  `17bfd58dcb540e25b605358cdc49402cbbcae1e249f2e479f847bd15347a7c76`.

**Résultats observés, sans les compter comme un portage réussi :**

Le reporter atteint les deux cas de la spec originale. Il affiche un échec
pour `encodes HTML entities` (`""` reçu au lieu de `"&#x3C;div&#x3E;"`) puis
un succès pour `handles empty strings`. Le Rust produit confirme que
`_encodeHtmlEntities` est encore un fallback `String::new()` ; le cas vide
est donc un **faux signal de validation du portage**, pas une preuve que
l'encodage Rust fonctionne. La vraie FFI HTML reste à écrire. Les assertions
suivantes du premier cas ne sont pas validées par cette exécution.

Le **premier arrêt fatal** est ensuite la panic `not implemented` dans
`Record_Unsafe_unsafeSet`, ligne 26 du Rust généré. La backtrace relie :

`consoleReporter / printSummary` → `Test.Spec.Summary.summarize` →
`monoidCount` → `Data.Semiring.semiringRecordCons` → `Record.Unsafe.unsafeSet`.

Le résumé initialise ses compteurs avec `Count zero`. La FFI existante
[`purust-prelude/src/Record/Unsafe.rs`](../purust-prelude/src/Record/Unsafe.rs)
ne fournit que `unsafeGet` et `unsafeHas` : `unsafeSet` est donc bien un
fallback manquant atteint en pratique. Aucun bilan final fiable ni contrôle
final « deux succès » n'est obtenu. La sortie 101 prouve cette panic, pas
encore le bon code de sortie d'une spec négative terminée normalement.

**Preuves conservées :**
[`build.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.json),
[`stdout`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.stdout.log),
[`backtrace complète`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution.stderr.log),
[`execution-provenance.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/execution-provenance.json)
et [`binary.json`](../../b8x/run/bak/rust/output/first-execution-Kk5IGG/binary.json).
Les checks de syntaxe des scripts et `git diff --check` passent. Les
**71 régressions de 0.11 ne sont pas relancées** : aucun code fonctionnel
n'a changé dans ce diagnostic.

**Baby step suivant, réalisé en 0.13 — Astra :** isoler puis implémenter uniquement
`Record.Unsafe.unsafeSet`, en partant de `zero :: { failed :: Int, passed :: Int,
pending :: Int }` et du résumé réel. La FFI JS crée une copie : couvrir
l'ajout et le remplacement d'un champ, la conservation des autres champs
et l'absence de mutation du record original partagé. Déterminer la bonne
transition entre les formes de records à partir du TAST/runtime, sans
effacer globalement leurs layouts ni exposer ces détails dans la FFI.
Valider `zero`, l'addition des compteurs et les résumés succès/échec/pending
par un reproducteur TAST en normal/threaded, puis relancer b8x et s'arrêter
au prochain blocage. Ne pas porter `unsafeDelete` ou la FFI HTML dans ce
même correctif ; ne pas remplacer les fallbacks restants par des succès.
Luna pourra compléter les cas répétitifs après validation de ce contrat.

M1 reste incomplet : **le binaire et les cas b8x s'exécutent désormais**, mais
avec un encodeur placeholder et un résumé interrompu ; les deux vrais
succès HTML et la fixture négative restent à valider.

### Micro-étape 0.13 — `Record.Unsafe.unsafeSet` et résumé Spec fonctionnel

Réalisée le 11 septembre 2026. Périmètre : cette FFI, le support des records
dans le générateur et leurs régressions. Ni `unsafeDelete`, ni la FFI HTML,
ni le runtime Aff n'ont été modifiés.

**Reproduction puis correction :**

- Le reproducteur compile **123 modules TAST frais**, dont le vrai
  `Test.Spec.Summary`. Avant correction, Cargo check réussit mais les trois
  tests Rust échouent sur le fallback `Record_Unsafe_unsafeSet` :
  [`commands.json du cas rouge`](/private/tmp/purust-record-set-tast-lAE5aG/commands.json).
- [`Record/Unsafe.rs`](../purust-prelude/src/Record/Unsafe.rs) délègue à
  `record.__purust_set_field(&field, value)`. La FFI ne dépend pas des
  structures de records générées.
- [`CodeGen.purs`](src/Purust/CodeGen.purs) conserve les formes natives pour
  les champs qu'elles peuvent contenir. L'ajout d'un champ hors forme passe
  seulement ce record dans `DynamicRecord`, un `BTreeMap<String, Value>`
  partagé par `PerceusPtr`. Les mises à jour utilisent le copy-on-write ;
  l'extension conserve les valeurs présentes sans exécuter les fonctions
  qu'elles contiennent. Aucun effacement global des layouts TAST.
- Les lectures ordinaires, empruntées et FFI, ainsi que les setters ordinaires,
  prennent en charge cette représentation d'extension. Les clés dynamiques
  utilisent leurs labels exacts, pas les identifiants Rust assainis.

**Régressions :**

- [`record-set-ffi.mjs`](tests/codegen/record-set-ffi.mjs) : ajout/remplacement,
  conservation des champs et des originaux partagés, clés connues seulement
  à l'exécution et réservées, copie superficielle, fonctions différées,
  libération des captures, thunk mémoïsé, rejet des non-records et mises à
  jour concurrentes indépendantes. **6 nouveaux tests Rust en normal et 7
  en threaded** ; le harness normal exécute aussi 4 tests du pointeur partagé.
- [`record-set.mjs`](tests/tast/record-set.mjs) : `zero`, addition des compteurs,
  résumé vide et résumé réel imbriqué (**2 succès, 1 échec, 1 pending**),
  extension d'une forme native puis projection/mise à jour ordinaires.
  **3 tests Rust par mode**, Cargo check/test réussis en normal et threaded.
- Suite complète : **73 tests Node passés, zéro échec**, environ **165,71 s**.
  Ce total couvre le compilateur/runtime, pas 73 specs b8x. Commande :

```sh
cd /Users/0x1/Documents/htdocs/purust/purust
PURS=/Users/0x1/Documents/htdocs/purescript/.stack-work/dist/aarch64-osx/ghc-9.8.4/build/purs/purs \
PURUST_RECORD_SET_KEEP_OUTPUT=/Users/0x1/Documents/htdocs/b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T \
node --test --test-concurrency=2 tests/codegen/*.mjs tests/tast/*.mjs
```

Preuves du reproducteur conservé lors de cette suite :
[`commands.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/purust-record-set-tast-Azaxsb/commands.json),
[`provenance.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/purust-record-set-tast-Azaxsb/provenance.json).
Bundle reconstruit hors ligne avec succès (**65 avertissements incrémentaux,
0 erreur**), contrôles de syntaxe Node, rustfmt et `git diff --check` réussis.
SHA-256 du bundle :
`689c42cfe194acc820ab0b1c276f321487fa0776b9e5c7c6c1ca7ce422b937f9`.
SHA-256 de la FFI `Record/Unsafe.rs` :
`d3539ecf80f9335b4972a14c2ea74f588d3936d590cfd15c19035cc505c8f293`.

**Nouvelle exécution b8x :**

Préparation neuve :
[`prepare-W1na2s/manifest.json`](../../b8x/run/bak/rust/output/prepare-W1na2s/manifest.json),
**211 modules TAST frais**, spec et point d'entrée inchangés. Diagnostic
[`unsafe-set-fixed-hPBD3T`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/generation.json)
avec caches/sorties isolés et empreintes revérifiées. Les scripts `audit.mjs`
et `build-run.mjs` suivent les mêmes commandes et bornes qu'en 0.12 et
refusent de réutiliser leurs sorties ; créer un dossier neuf pour répéter.

- **42 fichiers FFI**, **24 fallbacks**, dont **15 référencés** et 9 présents
  seulement comme définitions. `unsafeSet` provient désormais de la vraie FFI.
- Cargo check : **0** ; build/édition de liens : **0**, environ **16,01 s**.
- Exécution : **101**, environ **0,40 s**, sans timeout ni signal, stderr vide.
  Le reporter affiche l'échec d'encodage puis le cas vide vert, et termine
  cette fois son résumé : **`1/2 tests passed`**. La panic de fallback
  `unsafeSet` de 0.12 n'interrompt plus le résumé.
- Le point d'entrée exige toujours deux succès et lève une erreur Aff sinon.
  La sortie non nulle est observée après le résumé ; son message n'est pas
  imprimé. Le runtime existant remonte les exceptions via `resume_unwind`,
  sans hook de panic. Le contrat complet positif/négatif du runner et ses
  diagnostics restent à valider, sans compter ce lancement comme M1 réussi.
- Le blocage fonctionnel observé reste `_encodeHtmlEntities`, dont le Rust
  généré renvoie encore `String::new()`. Le test vide est toujours un faux
  signal de validation du portage ; aucune FFI HTML n'a été ajoutée.

Preuves :
[`symbols.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/cargo-check.json),
[`build.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/execution.json),
[`provenance native`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/execution-provenance.json),
[`binary.json`](../../b8x/run/bak/rust/output/unsafe-set-fixed-hPBD3T/binary.json).

**Baby step suivant, réalisé en 0.14 — Astra :** porter le seul fichier
`b8x/src/Util/Html/Encode/Encode.rs` selon le contrat 0.1. Vérifier les deux
symboles conservés (encodage et décodage), établir une parité ciblée avec
la FFI Node réelle, puis tester l'implémentation native générale, y compris
les entités et Unicode. Ne pas coder uniquement les quatre exemples ni
retoucher Cargo à la main pour masquer une dépendance non propagée.
Relancer les deux tests b8x originaux avec TAST frais et sans fallback HTML ;
s'arrêter au prochain écart observé. Luna pourra compléter les cas répétitifs
une fois le contrat validé. La fixture négative et le contrat de sortie final
restent un contrôle séparé avant M1.

### Micro-étape 0.14 — Vraie FFI HTML et deux tests b8x réussis

Réalisée les 11–12 septembre 2026. Premier fichier FFI local b8x :
[`src/Util/Html/Encode/Encode.rs`](../../b8x/src/Util/Html/Encode/Encode.rs).
Les deux fonctions étrangères sont implémentées : `_encodeHtmlEntities` et
`_decodeHtmlEntities`. Le TAST frais confirme dans les deux cas le contrat
`String -> String`, devenu `String -> String` côté Rust. Aucun changement
du compilateur, du runtime, des specs originales ou du point d'entrée.

**Contrat et représentation :**

- Référence : la FFI Node réelle de b8x et son package local **he 1.2.0**,
  avec les options par défaut. Le harness exige que la FFI JS générée soit
  identique au fichier source courant. Cela renouvelle la référence du FFI,
  mais pas la compilation JS complète de la spec, encore requise avant M1.
- Encodage hexadécimal majuscule ; décodage HTML en contexte texte, tolérant,
  en une seule passe, avec noms sensibles à la casse, formes historiques
  sans point-virgule et corrections des références numériques invalides.
  Références de contrat : [he](https://github.com/mathiasbynens/he) et
  [noms HTML](https://html.spec.whatwg.org/multipage/named-characters.html).
- Les `String` de purust contiennent des unités UTF-16 représentées par des
  scalaires Rust décalés, pas directement du texte UTF-8. L'encodeur utilise
  `purust_string_to_utf16` pour distinguer les paires et surrogates isolés ;
  le décodeur conserve les unités brutes et convertit les entités via
  `purust_string_from_utf8`. Aucune conversion UTF-8 avec perte.
- Le générateur ne propage pas encore des dépendances Cargo propres aux FFI.
  Ce fichier est donc autonome, avec la bibliothèque standard Rust et une
  table complète intégrée de **2 231 entrées** (2 125 noms avec point-virgule
  et 106 formes historiques). Table issue de he 1.2.0, licence MIT conservée
  dans le fichier. Aucun ajout de crate ni retouche de Cargo.toml généré.
- [`html-entities-table.mjs`](../../b8x/run/bak/rust/tests/html-entities-table.mjs)
  reproduit la table depuis la dépendance JS locale et peut imprimer son
  patch avec `--patch`. Le test vérifie que la table embarquée correspond
  exactement ; aucune génération ni dépendance Node n'est requise à l'exécution
  du binaire Rust. Le fichier FFI contient 2 377 lignes, principalement ces
  données générées ; ne pas maintenir les noms à la main.

**Parité native :**

```sh
cd /Users/0x1/Documents/htdocs/b8x
node run/bak/rust/tests/html-entities.mjs
```

**22 722 cas passés en normal, puis les mêmes 22 722 en threaded**, avec les
vrais helpers UTF-16 du compilateur et le vrai fichier FFI. Couverture :

- Les quatre assertions d'encodage et les exemples des quatre tests de
  décodage existants ; ces derniers sont vérifiés ici en natif, leur spec
  PureScript complète n'est pas ajoutée au profil des deux tests d'encodage.
- Chaque entrée de la table et ses suffixes ambigus ; références décimales,
  hexadécimales, hors Unicode, surrogates numériques et remplacements C1.
- Tous les **1 112 064 scalaires Unicode**, testés par blocs, et les
  **65 536 unités UTF-16**, dont surrogates isolés ; chaînes mixtes et sans
  entités, contrôles, non-caractères, références imbriquées non redécodées.
- Longues entrées adverses et 1 000 chaînes mixtes pseudo-aléatoires
  reproductibles. Le transport du harness préserve les unités UTF-16.

Preuve : [`html-ffi-J43vzv/parity.json`](../../b8x/run/bak/rust/output/html-ffi-J43vzv/parity.json),
avec empreintes FFI, he, harness, helpers, entrée et résultats des deux modes.
FFI SHA-256 :
`b3df1fc1f5a4fb1826838c5174f8f63dba63b9197b41d45429d78ca7db636bcb`.
he.js SHA-256 :
`76c554d5bbfd032fe620595076a50abea5124b9cbd4e9ffe6ac94a4f855aeceb`.
La première compilation isolée a révélé une double référence dans `peek()` ;
corrigée avant les deux validations de parité. Les **73 régressions de 0.13
ne sont pas relancées** : aucun code du compilateur/runtime n'a changé.

**Tranche b8x réelle :**

Préparation hors ligne neuve de **211 modules TAST** :
[`prepare-UCJhUa/manifest.json`](../../b8x/run/bak/rust/output/prepare-UCJhUa/manifest.json).
La première tentative sandboxée ne pouvait pas ouvrir le cache SQLite global
Spago ; la préparation autorisée hors sandbox réussit. Sources et sorties JS
existantes préservées. Bundle identique à 0.13, SHA-256 :
`689c42cfe194acc820ab0b1c276f321487fa0776b9e5c7c6c1ca7ce422b937f9`.

Diagnostic neuf :
[`html-ffi-fixed-QCPrdm/audit.mjs`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/audit.mjs),
puis [`build-run.mjs`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/build-run.mjs).
Les scripts utilisent un répertoire neuf et refusent d'écraser les résultats.
Les deux symboles HTML sont présents une seule fois, et le fichier FFI réel
est inclus intégralement dans le Rust généré.

- **43 fichiers FFI**, **22 fallbacks**, dont **13 référencés** et 9 présents
  seulement comme définitions ; plus aucun fallback HTML.
- Cargo check : **0**, environ **8,91 s** ; build/édition de liens : **0**,
  environ **14,90 s**.
- Binaire : **sortie 0**, environ **0,57 s**, sans timeout ni signal, stderr
  vide. Les deux tests originaux passent, avec leurs quatre assertions :
  `encodes HTML entities` et `handles empty strings`. Résumé complet :
  **`2/2 tests passed`**. Le contrôle final exige deux succès, zéro échec
  et zéro pending. Aucun succès déduit seulement du code de sortie.
- Les empreintes des sources, FFI, bundle et fichiers natifs sont vérifiées
  avant et après l'exécution. Les liens et scripts JS/Go/PHP restent inchangés.
  Syntaxe Node, rustfmt et `git diff --check` réussis.

Preuves :
[`generation.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/generation.json),
[`symbols.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/symbols.json),
[`cargo-check.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/cargo-check.json),
[`build.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/build.json),
[`execution.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/execution.json),
[`provenance native`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/execution-provenance.json),
[`binary.json`](../../b8x/run/bak/rust/output/html-ffi-fixed-QCPrdm/binary.json).

**Prochain baby step — Astra :** valider une fixture volontairement fautive
avec la vraie FFI HTML, dans une entrée diagnostique séparée, sans modifier
les specs b8x. Exiger une assertion effectivement échouée, un résumé cohérent,
une terminaison bornée et un code non nul ; distinguer l'échec attendu d'une
panic de fallback. Vérifier les messages d'erreur (la levée finale Aff de
0.13 n'imprimait pas son message). Revalider le contrôle positif et renouveler
la référence JS de la spec avec compilation fraîche et sorties isolées.
S'arrêter au premier écart observé, sans intégrer encore `bin/test` ni porter
d'autres FFI. Luna peut exécuter les variantes une fois les commandes et le
contrat d'erreur stabilisés.

M1 reste incomplet tant que ce contrôle négatif, la référence JS fraîche et
la qualification des fallbacks pertinents ne sont pas validés. L'exécution
positive des deux tests avec une vraie FFI Rust est désormais acquise.

## Phase 1 — Profil et sélection explicite du runtime Rust

- [x] Ajouter la configuration dédiée `b8x/run/bak/rust/spago.yaml` et son
  lockfile ; le profil de préparation utilise `prepare.mjs`.
- [x] Définir la sélection des sources et des dépendances du profil minimal :
  fermeture de 211 modules par `purs graph`, sans les modules applicatifs
  et intégrations hors périmètre.
- [x] Configurer les overrides `purust-*` dans le workspace isolé ; les
  arguments du futur backend sont enregistrés dans le manifeste.
- [ ] Activer la génération Rust une fois les prérequis et les fallbacks
  qualifiés. Le succès de la préparation TAST ne valide pas cette génération.
- [ ] Fixer les versions et le lockfile du profil. La baseline b8x utilise
  `spec` 8.1.1 et `spec-node` 0.0.3 ; `purust-spec` annonce 8.1.2 et un autre
  package set. Vérifier la compatibilité des API et des tests sans mettre à
  jour implicitement les profils existants.
- [ ] Fixer explicitement le binaire du fork PureScript, la version Spago,
  le backend recompilé et leurs révisions. Réutiliser la méthode des runners
  `purust-*` validés, en vérifiant les chemins depuis le répertoire de travail.
- [ ] Pour le runner final, rendre portables les chemins du runtime et les
  dépendances Cargo ; distinguer la racine b8x de l'installation de purust.
- [ ] Fixer puis ajouter l'option de sélection Rust à `b8x/bin/test`
  (proposition : `--runtime rust`).
- [ ] Propager le runtime de `bin/test` vers `bin/build` et `bin/run`.
- [ ] Ajouter un équivalent par variable d'environnement seulement si les
  scripts auxiliaires en ont besoin, avec une priorité claire de l'option CLI.
- [ ] Séparer TAST, cache Spago et sorties Cargo du profil Rust. Utiliser
  `--source` et `--out` explicitement ; leur défaut est relatif au répertoire
  de travail. Ne pas écraser les cibles des liens JS `output`, `.spago` et
  `spago.yaml` pendant l'essai isolé.
- [ ] Définir le comportement avec et sans build préalable : vérifier que le
  binaire lancé correspond au profil et au point d'entrée demandés. Conserver
  la signification de `bin/test -c`, qui nettoie les bases, pas la compilation.
- [ ] Conserver la détection et le comportement actuels des runtimes JS, Go et
  PHP lorsque `--runtime rust` n'est pas demandé.

Critère de sortie : le même test peut être lancé explicitement sous JS puis
sous Rust, sans ambiguïté dans la configuration ni dans les artefacts.

## Phase 2 — Runner de tests compatible Rust

Le runner actuel de b8x dépend de Node. Le premier point d'entrée Rust doit
charger seulement la spec choisie et les services de test nécessaires.

### Option recommandée

Créer un point d'entrée PureScript adapté à Rust, en réutilisant les specs et
assertions originales. Le module `Test.Spec.Runner` constitue une piste, mais
son portage FFI et ses dépendances restent à valider avant M1.

- [ ] Identifier les imports Node réellement nécessaires à `Test.Main`.
- [ ] Séparer la collecte des specs, l'exécution, le reporting et la sortie du
  processus.
- [ ] Pour le runner intégré, transmettre et appliquer réellement le filtre
  demandé. Tester le cas sans correspondance et le nombre attendu de tests ;
  un filtre d'exécution ne réduit pas à lui seul le graphe à compiler ni les
  effets déclenchés pendant la construction de la suite.
- [ ] Utiliser le runner générique `Test.Spec.Runner` lorsque ses dépendances
  sont suffisantes.
- [ ] Ajouter un point d'entrée Rust dédié si le `Test.Main` actuel ne peut pas
  être partagé sans imports Node.
- [ ] Porter ou remplacer la sortie console et les reporters nécessaires.
- [ ] Faire remonter un résultat de suite au point d'entrée Rust et sortir avec
  un code non nul en cas d'échec. Propager aussi les erreurs du compilateur,
  de Cargo, les panics et les signaux à travers les wrappers.
- [ ] Réutiliser l'attente fournie par `purust_aff_run_main` avec `--threaded`.
  Une sortie immédiate du processus ne doit pas court-circuiter les nettoyages
  et l'attente des fibres. Ne pas recréer un moteur Aff ou un keep-alive natif.
- [x] Fournir `Effect.Now.now`, requise pour le chronométrage de chaque test,
  et valider son effet isolément (0.5), puis son utilisation par la spec
  ciblée (0.14). Le package Now complet, dont `getTimezoneOffset`, n'est pas porté.

### Dépendances du runner à porter ou isoler

- [ ] `Test.Spec`, `Test.Util.Assert` et les assertions nécessaires. La validation
  de `purust-assert` ne couvre pas le package distinct `purust-spec`.
- [ ] Console/reporter utilisé par les tests.
- [ ] Assertions de chaînes et erreurs attendues.
- [ ] Sortie du processus et code de sortie.
- [ ] Horloge réelle pour `Effect.Now`, notamment les appels internes du runner.
- [ ] Aff/AVar et dépendances transitives réellement générées : notamment Pipes,
  datetime, refs et exceptions ; réutiliser les implémentations disponibles et
  inventorier les FFI encore absentes avant de les porter.

Critère de sortie : une suite volontairement fautive échoue réellement sous
Rust, et une suite corrigée termine avec un code nul après exécution complète.

## Phase 3 — Inventaire et portage des FFI b8x

Pour chaque module du graphe des tests ayant des déclarations étrangères, y
compris les dépendances de paquets :

- [ ] Identifier les fonctions utilisées par les tests, pas seulement toutes les
  fonctions déclarées.
- [ ] Distinguer ces appels des déclarations étrangères effectivement conservées
  par le générateur. Relever pour chacune le type TAST, le chemin `.rs` résolu,
  le symbole attendu et la couverture ; contrôler les doublons entre paquets.
- [ ] Décider si la fonction doit être portée, remplacée par une abstraction
  backend-neutre au même contrat, ou éliminée parce qu'elle n'appartient pas au
  graphe des tests. Un test actif bloqué reste à porter.
- [ ] Ajouter le FFI Rust au chemin miroir du module PureScript.
- [ ] Respecter les noms `Module_Function` attendus par purust.
- [ ] Respecter les types TAST, l'arité, les valeurs différées et le contrat
  `Aff`. Exploiter `ann.type`, `dataDecls`, `classDecls` et les instanciations
  `TypeApp` ; ne pas compenser une perte de type supposée par des valeurs
  opaques ou des valeurs par défaut.
- [ ] Ajouter un test positif et, lorsque pertinent, un test négatif.
- [ ] Interdire le fallback silencieux pour les FFI demandées par les tests.

### Ordre de portage recommandé

1. Prérequis manquants de la spec sélectionnée et de son runner : Spec, Now et
   leurs FFI, en réutilisant le socle Effect/Aff/AVar déjà disponible.
2. Premier module d'encodage HTML, puis utilitaires atteints par les tests :
   chaînes, JSON, variantes et assertions.
3. FFI simples utilisées par les modules Core et Util de b8x.
4. FFI de fichiers, UUID, crypto et configuration si elles apparaissent dans le
   graphe unitaire.
5. PostgreSQL, RabbitMQ et EventStore pour les intégrations.
6. Modules UI/navigateur hors du graphe : les laisser hors du profil initial.
   Un module nommé Node mais utilisé par un test exige un adaptateur compatible
   ou une substitution justifiée, pas une exclusion automatique du test.

## Phase 4 — Intégration du socle Aff déjà validé

Les primitives et scénarios Aff ont des validations historiques décrites plus
haut. Les cases suivantes concernent leur utilisation effective par b8x.

- [x] Activer `--threaded` et vérifier que le main généré utilise
  `purust_aff_run_main` (génération diagnostique 0.3). La validation
  d'exécution ci-dessous reste à faire ; ce mode doit être commun aux FFI.
- [ ] Vérifier le scénario Spec positif et négatif, les timeouts et la fin des
  fibres/ressources au retour du runner b8x.
- [ ] Vérifier l'annulation et le nettoyage des nouvelles FFI externes sur
  succès, erreur et interruption, en respectant leur contrat existant.
- [ ] Vérifier les captures `Send + Sync`, références partagées et callbacks
  introduits par les adaptateurs b8x.
- [ ] Après une modification du runtime ou du générateur, relancer les suites
  existantes pertinentes d'Aff, AVar et de durée de vie ; étendre seulement si
  le changement ou un échec le justifie.

Critère de sortie : aucun test vert ne doit dépendre d'un callback abandonné ou
d'un processus terminé prématurément.

## Phase 5 — Suite unitaire b8x

- [ ] Lancer toutes les suites sans services externes sous JS pour établir le
  nombre de tests et les résultats de référence.
- [ ] Lancer les mêmes suites sous Rust avec TAST frais.
- [ ] Comparer les tests exécutés, les résultats et les erreurs, sans comparer
  seulement le code de sortie global.
- [ ] Corriger les écarts de sémantique. Consigner les blocages et exclusions
  temporaires comme travail restant ; ne pas les compter comme tests passés.
- [ ] Vérifier les répétitions et les effets rejouables lorsque les tests les
  exercent.
- [ ] Vérifier la libération des ressources après chaque suite.
- [ ] Faire passer la suite unitaire complète avant d'activer les services
  externes.

Critère M2 : toutes les suites sans services externes exécutées, avec les
assertions originales et leurs nombres de tests vérifiés.

## Phase 6 — Clients PostgreSQL/RabbitMQ, EventStore et projections

- [ ] Lister les modules et FFI réellement atteints par chaque suite
  d'intégration.
- [ ] Porter ou compléter le pont `Promise`/`Promise.Aff` utilisé par les deux
  clients et les handles étrangers. Valider résolution/rejet, exécution des
  callbacks et comportement à l'annulation ; ne pas supposer que disposer
  d'Aff suffit à exécuter ces FFI.
- [ ] Choisir les clients Rust adaptés et encapsuler leurs différences derrière
  les mêmes contrats PureScript.
- [ ] Porter l'initialisation, les connexions, les transactions et le nettoyage.
- [ ] Définir le lieu d'exécution du runner final, local ou dans `api-cli`,
  et la disponibilité du binaire Rust et de ses dépendances. Reprendre les
  paramètres depuis la configuration b8x existante et les fixtures de bases
  de test, sans inscrire de secrets dans les sources ou le todo.
- [ ] Vérifier les erreurs réseau, timeouts, retries et annulations.
- [ ] Vérifier que les ressources sont fermées même après un échec de test.
- [ ] Éviter qu'une intégration externe soit considérée verte si le service est
  simplement absent ou si une FFI fallback a absorbé l'erreur.

Critère M3 : clients et pont Promise/Aff validés.

Critère M4 : suites EventStore PostgreSQL et projections, puis suite b8x
complète. Les fixtures de ces suites utilisent déjà PostgreSQL et RabbitMQ ;
ce ne sont pas trois infrastructures indépendantes.

## Phase 7 — Fiabilisation de purust pour b8x

Les points bloquant M1 sont traités dès la première tranche ; cette section
ne repousse pas le contrôle de l'ABI et des FFI absentes à la fin du projet.

- [ ] Remplacer les chemins codés en dur par des chemins portables dérivés du
  projet ou par une configuration explicite.
- [ ] Documenter le contrat exact d'une FFI `.rs` : noms, signatures, valeurs,
  effets, ownership et `Send`/`Sync` lorsque nécessaire.
- [ ] Faire échouer la génération lorsqu'une FFI requise est absente ou qu'un
  symbole attendu est remplacé par un stub. Couvrir le fichier absent, le
  symbole absent et la déclaration sans type exploitable. Distinguer les
  primitives réellement implémentées par le générateur des fallbacks factices.
- [ ] Couvrir aussi les types étrangers et leurs coercions : l'inventaire de
  `foreign` seul n'inclut pas `Data.Exists`. Reproducteur en 0.5, correction
  et régression native normale/threaded en 0.6 ; type et FFI `Data.Lazy`
  validés en 0.8. La couverture générale reste à compléter.
- [ ] Vérifier que supprimer le fichier `.rs` ciblé ou renommer son symbole
  provoque un échec explicite dans une fixture isolée ; une valeur par défaut
  `0`, `false` ou chaîne vide ne constitue pas une implémentation.
- [ ] Ajouter une trace diagnostique activable pour la résolution des FFI.
- [ ] Ajouter une régression minimale pour chaque correction générale du
  générateur ou du runtime.
- [ ] Vérifier que les dépendances Cargo des FFI sont propagées sans dépendre
  d'un état résiduel de `output/`. Identifier le mécanisme réellement utilisé
  avant de choisir une bibliothèque ; une retouche manuelle du Cargo.toml
  généré ne rend pas le pipeline reproductible.
- [ ] Vérifier que le TAST est toujours produit par le fork PureScript local et
  que les sorties obsolètes sont nettoyées.

## Matrice de validation finale

À renseigner avec les commandes et preuves. Les cases sont actuellement non
vérifiées. Rust doit couvrir tous les tests actifs ciblés ; JS fournit la
référence. Go/PHP ne constituent une obligation de non-régression que pour les
chemins existants affectés par les changements communs. Indiquer « non couvert
historiquement » ou « non exécuté » si nécessaire, jamais une réussite supposée.

| Cas | JS | Go | PHP | Rust |
| --- | --- | --- | --- | --- |
| Test pur minimal | [ ] | [ ] | [ ] | [ ] |
| FFI locale | [ ] | [ ] | [ ] | [ ] |
| Échec attendu | [ ] | [ ] | [ ] | [ ] |
| Effets Aff | [ ] | [ ] | [ ] | [ ] |
| Annulation | [ ] | [ ] | [ ] | [ ] |
| PostgreSQL | [ ] | [ ] | [ ] | [ ] |
| RabbitMQ | [ ] | [ ] | [ ] | [ ] |
| EventStore | [ ] | [ ] | [ ] | [ ] |
| Projections PostgreSQL | [ ] | [ ] | [ ] | [ ] |
| Suite complète | [ ] | [ ] | [ ] | [ ] |

## Règles de validation

- Pour la validation Rust et les comparaisons de parité, produire un TAST frais
  avec le fork local. La première référence JS de la micro-étape 0.1 reste un
  relevé explicitement limité aux artefacts existants.
- Conserver la commande exacte, le commit du compilateur et les sorties
  pertinentes pour chaque micro-étape.
- Ne cocher une validation qu'après exécution réelle. Pour un choix de plan ou
  un inventaire, indiquer explicitement la preuve de lecture et les vérifications
  d'exécution restant à faire.
- Distinguer clairement : test passé, test échoué, test bloqué, test exclu et
  test non exécuté.
- L'objectif est fonctionnel. Si une comparaison de performances devient
  nécessaire, utiliser les baselines officielles du README d'altbak.pub ; un
  run isolé ne suffit pas et les benchmarks ne bloquent pas ce plan de portage.
- Utiliser les contrats et fixtures `gopurs-*` comme références, sans supposer
  que leur existence prouve la compatibilité Rust.

## Prochaine action

- [x] Astra : choisir le premier test, sa FFI et son contrat (micro-étape 0.1).
- [x] Luna : exécuter uniquement la commande JS de référence de la
  micro-étape 0.1 ; noter les deux tests, le résumé et le code de sortie.
- [x] Astra : définir le point d'entrée PureScript, isoler ses sources et
  compiler le TAST frais ; inventorier les prérequis et enregistrer les
  arguments du backend avec `--threaded` (micro-étape 0.2).
- [x] Astra : qualifier les 13 modules sans `.rs` voisin et les trois noms non
  retrouvés textuellement ; fixer le premier prérequis Spec/Now à porter
  (micro-étape 0.3 : 29 fallbacks, premier portage `Test.Spec.Console.write`).
- [x] Luna, `medium` : porter uniquement `purust-spec/src/Test/Spec/Console.rs`
  et ajouter sa régression native selon le contrat 0.3 ; régression passée en
  modes normal et threaded, sans étendre le portage aux autres FFI
  (micro-étape 0.4).
- [x] Astra : porter et valider `Effect.Now.now`, compléter les validations
  console prévues, puis relever le premier blocage Cargo et les fallbacks
  conservés (0.5 : 27 fallbacks, 18 référencés ; reproducteur `Data.Exists`).
- [x] Astra : corriger les deux défauts de génération de `Data.Exists` dans
  le reproducteur à deux modules et ajouter sa régression (0.6 : Cargo minimal
  réussi, 45 tests codegen et 17 tests TAST passés).
- [x] Astra : isoler `Data.Lazy` et fixer le contrat natif de représentation,
  de mémorisation et de concurrence (0.7 : reproducteur 77 modules, cinq
  erreurs Cargo par mode ; cinq vérifications sur la vraie FFI JS passées).
- [x] Astra : porter `purust-lazy/src/Data/Lazy.rs` et ses régressions selon
  le contrat 0.7 (0.8 : Cargo minimal normal/threaded réussi ; 65 régressions
  passées ; b8x bloque maintenant sur les dictionnaires `Effect.Aff.Class`).
- [x] Astra : corriger le typage natif du dictionnaire `MonadAff` sans modifier
  l'ABI Aff (0.9 : Cargo sur 120 modules réussi, vraie exécution Aff validée,
  67 régressions passées ; nouveau blocage `Control.Monad.Free`).
- [x] Astra : isoler et corriger la confusion `Val`/`Step` dans `freeMonadRec`
  (0.10 : 91 modules TAST frais, cinq tests Rust par mode normal/threaded,
  blocage levé dans b8x ; prochain blocage `Pipes.Internal.X`).
- [x] Astra : isoler et corriger la représentation du newtype récursif
  `Pipes.Internal.X` et de `closed` (0.11 : cinq tests Rust par mode,
  premier `cargo check` b8x complet réussi).
- [x] Astra : construire et lancer le profil minimal en diagnostic borné
  (0.12 : build 0, exécution 101 ; cas HTML atteints avec fallback, puis
  panic `Record.Unsafe.unsafeSet` lors du résumé).
- [x] Astra : implémenter et valider uniquement `Record.Unsafe.unsafeSet`
  (0.13 : 73 régressions passées, résumé b8x terminé `1/2 tests passed` ;
  encodage HTML encore remplacé par un fallback).
- [x] Astra : porter le premier fichier `Util/Html/Encode/Encode.rs` et vérifier
  les deux symboles étrangers (0.14 : 22 722 cas de parité par mode,
  deux tests b8x originaux réussis, résumé complet et sortie 0).
- [ ] Astra : valider la fixture négative avec la vraie FFI, les codes de
  sortie/messages et la référence JS fraîche, selon le contrat 0.14,
  avant tout portage supplémentaire.
- [ ] Astra : poursuivre la qualification des bindings et fallbacks conservés,
  dont les autres opérations de records, selon les chemins réellement atteints ;
  porter ou éliminer par preuve, sans portage préventif de `unsafeDelete`.
