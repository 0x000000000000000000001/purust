# Purust — rejoindre les performances du compilateur Go

Plan du **2 octobre 2026**. Priorité : réduire le travail PBO rejeté, puis
les allocations des passes dominantes du compilateur natif.

## Nouvelle passe allocations gopurs — 3 octobre 2026

- [x] Figer la référence corrigée `cf7a0660…`, ses sources, les trois hôtes,
  les bootstraps Purust et le frontend dans
  `../../altbak.pub/var/benchmark/gopurs-rust-allocation-20261003/`.
- [x] Profiler PBO/émission à huit workers : **4 891 échantillons non
  bloquants**, dont maps/sets **989**, allocation **873**, copies de `Value`
  **546**, copies de chaînes **292**. Familles inclusives qui se recouvrent,
  pas des pourcentages CPU ; **294 fichiers Go/manifests exacts**.
- [x] Sélectionner et mesurer un changement ciblé, puis qualifier production,
  défauts publics et workers explicites selon `confirmation-protocol.json`.
  Le passage reproductible sous trois secondes reste un objectif à démontrer.

Premiers candidats : retrait natif des contributions de directives dans
`Builder.effectiveDirectives` (premier appelant collections du profil, **281
échantillons**), puis comparaison qualifiée Rust par emprunt. Un témoin à
sources inchangées est reconstruit séparément. Le contrat de suppression
compare chaque arbre au `delete` PureScript généré et à un modèle clé/valeur.
Deux diagnostics initiaux de test sont conservés : l'assertion stricte de
balance échoue aussi sur l'oracle généré, après égalité exacte des deux arbres ;
le contrat retient sa forme réelle, les tailles/hauteurs, lectures et versions
persistantes plutôt qu'une propriété plus forte que l'oracle.

- Suppression native seule **écartée** : cinq tours, médianes référence
  **3 783**, témoin reconstruit **3 819**, candidat **3 828 ms**. Les quinze
  suites PBO et le contrat natif passent ; **18 générations / 5 292 fichiers
  exacts** revérifiés. Sources expérimentales, binaire, tests et diagnostics
  restent archivés ; le code vivant revient à la référence pour ce candidat.
- L'attribution par opération écarte les petites métadonnées de Convert : son
  principal coût est `filterWithKey` (**95** échantillons), pas `alter` (**20**).
  En préparation, `Monomorphize.collectExpr -> insertWith` représente **137**
  échantillons. Essai ciblé de fusion native de maps String sur ses deux appels,
  avec ordre du callback existant/entrant vérifié par un oracle non commutatif.
- Fusion native des spécialisations, confirmation marginale : **3 907 →
  3 811 ms (−2,5 %)**, **11/15 paires favorables**, écart apparié médian
  **−107 ms**, moyen **−103,7 ms**. Sélection provisoire, en attente de la
  composition et de la qualification de production. **32 sorties exactes** ;
  4 000 mises à jour différentielles vérifient aussi l'ordre et le nombre des
  appels de fusion, Unicode et la persistance.
- Comparaisons qualifiées : le chemin Rust emprunte modules et identifiants ;
  les oracles PS séparés demeurent les replis JS/Go. Les **huit suites natives**
  passent sur le candidat composé, dont **396 900 paires** comparées aux oracles
  PS et à l'instance générique. Sélection cinq tours : référence **3 690**,
  fusion native **3 682**, composé **3 629 ms**, avec **5/5 paires favorables**
  au composé face à la fusion seule. Qualification finale encore à réaliser.
- Déduplication APFS documentée des seuls artefacts terminés du nouveau lot :
  **17 339 fichiers / 1 085 454 694 octets logiquement dupliqués**, empreintes
  vérifiées. Chaque fichier garde son inode indépendant et sa sémantique de
  copie sur écriture ; aucun résultat ni diagnostic retiré.
- Nettoyage demandé de `purust/` : **neuf caches Cargo** régénérables retirés,
  **40 136 396 800 octets (37,4 Gio)** effectivement libérés ; **6 186 fichiers
  protégés** revérifiés par SHA-256 et états Git des **58 dépôts** contrôlés,
  hors métadonnées Finder `.DS_Store` modifiées indépendamment. Sources,
  exécutables, sorties générées et preuves historiques restent disponibles.
  Audit et deux diagnostics préalables Finder conservés dans
  `purust-cleanup-{protected,results}.json` et les logs du nouveau lot.
- Essai de profil **ThinLTO** sur le Rust généré du candidat composé, sans
  nouveau changement de source. Le premier build a échoué par manque d'espace
  disque ; diagnostic conservé sous `candidates/thin-lto/`. Après nettoyage,
  la reprise `thin-lto-retry` échoue à la liaison : bitcode LLVM **22.1.2** de
  Rust incompatible avec le lecteur Apple LLVM **17**. Le troisième build,
  `thin-lto-rust-lld`, réussit avec le linker Mach-O fourni par Rust, SHA-256
  `695f239b52eef3c6551fdda84147710e54eeeed066cd545dd85291ce7545eb30`.
  Les deux campagnes externes identifiées ont terminé ; la sélection est
  lancée après nouvel inventaire des processus.
- Des corrections concurrentes de labels de records et de décodage JSON ont
  modifié cinq fichiers depuis le candidat `qualified` ; inventaire dans
  `source-integration.json`. L'intégration de production devra les conserver,
  être figée et remesurée, avec distinction entre les sélections isolées et
  le changement net du compilateur installé.
  Les candidats `integrated` et `integrated-thin-lto` sont construits ; leur
  campagne dédiée vérifie séparément cette composition : **3 675 → 3 533 ms**,
  quatre paires sur cinq favorables au profil ThinLTO, sorties toutes exactes.
- **ThinLTO sélectionné** après confirmation sur les sources intégrées :
  **3 662 → 3 495 ms (−4,6 %)**, moyennes **3 662,5 → 3 491,2 ms**, **14/15
  paires favorables**, **32 générations exactes**. L'essai isolé précédent
  donnait **3 675 → 3 521 ms**, 5/5 favorables. Le build de production adopte
  O3/ThinLTO et le linker de la toolchain Rust sur macOS ; reconstruction et
  qualification complète réussies. Le seuil de trois secondes reste ouvert.
- **Production installée et qualifiée** : **500 modules / 290 797 types**,
  **1 008 fichiers** identiques entre bootstraps Purust JS/natif et **1 009**
  entre candidat/production (script de liaison compris). **43 tests
  compilateur**, **19 tests préparation**, parseur Go et cache Go `-race`
  passent. Les trois hôtes passent **45 contrôles Aff + stress AVar 1 000**,
  avec **294 fichiers Go identiques** ; le chemin public Rust/Aff `-c` et le
  smoke Go/FFI frais passent. Rust installé :
  `24ed33ad2624f8442080c2c0a256bae7b5e041ab37cfb6f86253c1ffb0152f3a`.
  Les campagnes principales, communes, défauts et ressources, les profils
  finaux et la relecture indépendante sont terminés.
- **Confirmation finale : 3 623 → 3 353 ms (−7,5 %)**, **15/15 paires
  favorables**. Dix tours communs : **JS 7 364 / Go 1 997 / Rust avant 3 572 /
  Rust final 3 414 ms**, rapport Rust/Go **1,789× → 1,710×**. Aux défauts
  publics, cinq tours : **Rust 3 760 → 3 394 ms (−9,7 %)**, 5/5 favorables,
  **Go 2 064 / JS 7 265 ms**. Les témoins sont remesurés dans chaque campagne.
  Le changement net intègre les deux optimisations natives, ThinLTO et les
  corrections concurrentes archivées ; les sélections isolées conservent leur
  portée. Les gains historiques ne s'additionnent pas à ce résultat.
- **262 générations / 77 028 fichiers Go/manifests exacts** relus dans onze
  campagnes, chauffes comprises. Profils finaux : **6 241** échantillons non
  bloquants sur tout le backend et **4 112** sur PBO/émission ; familles
  allocation **1 136 / 719**, copies de `Value` **614 / 363**, chaînes **212 /
  103**, collections **1 436 / 913**. Familles inclusives qui se recouvrent,
  pas des pourcentages CPU ; l'inlining ThinLTO change aussi la visibilité des
  piles. Aucune des trente mesures finales principales/communes/défauts du
  compilateur installé ne passe sous trois secondes.
- Ressources, trois paires séparées : CPU utilisateur+système **7,56 → 7,02 s
  (−7,1 %)** ; pic RSS **559,2 → 554,9 Mio**. Rapport Markdown/JSON publié et
  ligne `gopurs-aff` actualisée avec les dix tours communs ; audit de publication
  dans `publication-audit.json`. Les **18 sorties JSON → Typed AST historiques**,
  **six exécutables** et empreintes structurelles ont été relus avec succès.

Rapport : `../../altbak.pub/docs/benchmark-results/2026-10-03-gopurs-rust-allocation.{md,json}`.

## Correction des valeurs par défaut de gopurs — 3 octobre 2026

L'utilisateur observe **Go 2 251 / Rust 6 030 ms** avec les commandes publiques.
Cause confirmée : la branche Rust du launcher lançait l'exécutable avant le
réglage automatique des workers. Rust gardait préparation **2** / PBO **1**,
alors que la comparaison optimisée ci-dessous forçait **8/8/8/8** pour tous.
La commande sans réglages avait été qualifiée fonctionnellement, mais les temps
publiés correspondaient à la configuration explicite.

- [x] Appliquer la politique de parallélisme avant le choix de l'hôte, en
  préservant les réglages explicites et le seuil de **32 Gio**. Dissocier ce
  choix de `GOGC`/`GOMEMLIMIT` ; réserver le réglage automatique du GC à Go.
- [x] Afficher les limites effectives préparation/PBO/émission et le pipeline.
- [x] Vérifier la régression du launcher, reconstruire JS/Go/Rust, qualifier
  Aff et CLI/FFI, mesurer les défauts contre l'ancien launcher et les workers
  explicites sur le corpus figé, puis publier les preuves.

**Correction qualifiée et installée.** Commande exacte `GOPURS_RUST=1 ./bin/test`,
sans réglage de workers : **3 683 ms**, préparation **1 150 ms**, PBO/émission
**2 297 ms**, avec la ligne `workers: prepare=8, pbo=8, emit=8, pipeline=true`.
La reconstruction par `-c` passe aussi. Commandes Go/JS ordinaires de la même
qualification : **2 248 / 6 943 ms** (passages fonctionnels uniques).

Confirmation figée, une chauffe et cinq tours tournants : **Rust ancien défaut
5 772 / défaut corrigé 3 701 / huit explicites 3 784 / Go 2 194 / JS 7 542 ms**.
Le changement de défaut réduit la médiane Rust de **35,9 %**, avec **5/5 paires
favorables** ; moyennes défaut/explicite **3 749,2 / 3 754,4 ms**. La campagne
mesure les réglages du compilateur déjà optimisé ; le gain historique ci-dessous
conserve son protocole à workers explicites.

Validation : **43 tests launcher/CLI/codegen**, zéro skip ; trois contrats
échouent sur l'ancien launcher et les six passent après correction. Les trois
hôtes passent **45 contrôles Aff + stress AVar 1 000**, avec **294 fichiers Go
identiques** à la qualification précédente. Bootstrap **500 modules / 290 702
types / 1 008 fichiers Rust/Cargo identiques** ; smoke frais et parseur `-race`
réussis. Les **30 générations / 8 820 fichiers** sont revérifiés indépendamment.

Rust installé : `cf7a066084a8a154312fed6e7df6c9deb3a08f0588d0c9c3e7c1bf9f51d62615`.
Rapport : `../../altbak.pub/docs/benchmark-results/2026-10-03-gopurs-host-defaults.{md,json}`.

Archive : `../../altbak.pub/var/benchmark/gopurs-host-defaults-20261003/`.

## Optimisation de gopurs hébergé en Rust — 3 octobre 2026

**Terminé, qualifié et installé : −39,0 % sur le véritable gopurs hébergé en
Rust, générant du Go.** Confirmation principale : **5 886 → 3 592 ms** sur
quinze paires, **15/15 favorables**. Dans les dix tours communs : **JS 7 549 /
Go 2 165,5 / Rust avant 6 176 / Rust optimisé 3 780,5 ms** ; rapport Rust/Go
**2,852× → 1,746×**, soit **59,7 % de l'écart absolu résorbé**. Le gain substantiel
est établi ; la parité stricte reste à atteindre.

La qualification initiale distincte donnait **Rust 5 782,5 / Go 2 116,5 /
JS 7 718,5 ms**. Le témoin Rust est remesuré dans chaque campagne ; le résultat
historique de Purust ci-dessous conserve son périmètre propre.

- [x] Figer les trois exécutables gopurs, leurs sources, les bootstraps Purust
      JS/natif et le frontend dans `gopurs-rust-optimization-20261003/`.
- [x] Profiler le véritable binaire `ad7fd6a9…`, avec les paramètres communs
      8/8/8/8 et pipeline. Sortie : **294 fichiers Go/manifests exacts**.
      Diagnostic instrumenté : **358 tentatives / 238 modules**, **120 rejets** ;
      familles substitution **2 019**, directives **456**, décodage **547**,
      validation d'usage **312** sur **11 013** échantillons non bloquants.
      Familles inclusives qui se recouvrent, pas des pourcentages CPU.
- [x] Contrôle A/A du même exécutable : trois tours, **5 969 / 6 081 ms**,
      plage **5 895–6 367 ms**, huit sorties / **2 352 fichiers exacts**,
      vérifiés indépendamment. Protocole final pré-déclaré : quinze paires,
      dix tours communs et trois paires CPU/RSS après une chauffe.
- [x] Reporter et mesurer séparément les optimisations PBO communes applicables.
- [x] Qualifier tests différentiels/PBO, trois hôtes, Aff complète, bootstrap
      JS/natif exact et projet frais ; préserver les empreintes JSON historiques.
- [x] Confirmer avant/après puis refaire dix tours de comparaison commune sur
      les 238 modules figés ; publier les échantillons et mettre à jour le README.

Résultats finaux :

- Médianes Rust par phase : chargement/tri **809 → 212 ms**, préparation
  **1 743 → 1 122 ms**, PBO/émission **3 432 → 2 221 ms**. Les médianes ne
  s'additionnent pas. **238 tentatives / 238 modules / zéro rejet**, contre
  **114–121 rejets** avant sur les seize passages, chauffe comprise.
- Ressources, trois paires séparées : CPU utilisateur+système **13,34 → 7,55 s
  (−43,4 %)** ; pic RSS **594,38 → 566,58 Mio**.
- Vérification indépendante des dix campagnes : **208 générations /
  61 152 fichiers Go/manifests exacts**, y compris toutes les chauffes.
- Résultats JSON → Typed AST historiques conservés : **18 sorties brutes**,
  six exécutables archivés et empreintes structurelles Go/Rust revérifiés.
- Exécutable installé lors de cette campagne d'optimisation :
  `f099077b7f6daf4fa0606e3b66919046f5fa205c17c5f3f09449a71e0ff23478`.
  Les sélecteurs Go/JS/Rust et la commande exacte `GOPURS_RUST=1 ./bin/test`
  passent ; `-c` reconstruit et valide également ce compilateur.
- Rapport et données :
  `../../altbak.pub/docs/benchmark-results/2026-10-03-gopurs-rust-optimization.{md,json}`.
  La ligne `gopurs-aff` du README reprend les dix tours communs. Les autres
  cellules Rust non mesurées et la présentation des deux tableaux sont préservées.

Archive : `../../altbak.pub/var/benchmark/gopurs-rust-optimization-20261003/`.
Un nettoyage documenté des caches Cargo de l'ancienne qualification libère
7,84 Go logiques ; ses treize exécutables conservés ont été ré-empreintés.

Journal de sélection gopurs (chaque témoin est remesuré dans sa campagne) :

- Ordonnanceur : quatre régressions FIFO/LIFO/attentes implicites passent ;
  cinq paires **6 224 → 5 574 ms (−10,4 %)**, douze sorties exactes.
- Identité des clés Rust : cinq tours **avant 5 585 / ordonnanceur 4 997 /
  cache 4 592 ms** ; gain marginal **8,1 %**, cumulé **17,8 %**, dix-huit
  sorties exactes. Les enveloppes `Any` ne servent plus de clé aux arbres partagés.
- Directives : cinq tours **avant 5 905 / cache 4 801 / directives 4 275 ms** ;
  marginal **11,0 %**, cumulé **27,6 %**. Préparation **1 692 → 1 150 ms**,
  dix-huit sorties exactes. Le shim Go délègue au parseur PS, comme JS.
- `CoreFn/Json.rs` et `Usage.rs` transférés à l'identique du fork Purust : cinq
  tours **avant 6 296 / directives 4 312 / TAST 3 765 ms**, marginal **12,7 %**,
  cumulé **40,2 %**. Chargement **814 → 214 ms** ; dix-huit sorties exactes.
  Les six suites natives passent sur les crates de gopurs : cache, directives
  (**169 + 352 lignes / 33 replis**), usage (**238 modules + cas synthétiques**),
  annotations (**110 909**), modules (**238 natifs / 51 frontières**) et tables
  (**824 tables / 149 495 entrées**). Le harnais vérifie les sources FFI entières
  contre celles embarquées dans le compilateur, avec SHA-256 conservés.
- L'audit de préparation attribue **230 échantillons** à l'insertion générique
  dans l'index AST global. Changement gopurs ciblé : réutiliser `NativeMaps` pour
  cette seule insertion, avec contrat de lecture générique et tests Unicode.
  Confirmation marginale quinze paires : médianes **3 747 → 3 596 ms**,
  moyennes **3 704,6 → 3 634,9 ms**, **11/15 favorables**, 32 sorties exactes.
  La septième suite native de maps passe (forme AVL, comparateurs, Unicode,
  persistance) ; les quinze suites sémantiques PBO passent aussi.
  Les autres métadonnées totalisent moins de vingt échantillons ; elles ne
  justifient pas une nouvelle spécialisation.
- Production reconstruite : **500 modules / 290 647 types**, bootstrap JS/natif
  identique et sources Rust identiques au candidat retenu. **37 tests CLI/codegen**,
  **19 tests préparation/auxiliaires**, parseur et cache Go `-race`, trois hôtes
  Aff (**45 contrôles + stress AVar 1 000**) et chemin Rust `-c` réussis.
  Le premier essai du nouveau test de filtrage des maps omettait `Ord` : corrigé,
  puis qualification reprise ; diagnostic initial et logs distincts conservés.
- Une coupure réseau a interrompu deux audits délégués ; la campagne du cache
  a fini localement, ses résultats ont été repris depuis les logs conservés.

## Résultat historique de Purust — 3 octobre 2026

**Correction de périmètre, 3 octobre :** les mesures ci-dessous comparent
gopurs générant du Go à Purust générant du Rust. Elles restent les résultats de
l'optimisation de Purust, mais ne mesurent pas gopurs exécuté sur trois hôtes.
La demande utilisateur est désormais traitée par un bootstrap de **gopurs en
Rust**, conservant sa génération Go. `GOPURS_RUST=1` doit sélectionner cet
exécutable. **Correction terminée et qualifiée** : 500 modules / 290 636 types,
1 008 fichiers de bootstrap identiques entre Purust JS et natif ; Aff passe
sur les trois hôtes avec 45 contrôles, stress AVar 1 000 et 294 fichiers Go
identiques. La campagne de dix tours donne **gopurs JS 7 718,5 ms / Go 2 116,5 ms /
Rust 5 782,5 ms** (Rust/Go **2,732×**, Rust/JS **0,749×**), à paramètres de workers
identiques. Les 33 générations / 9 702 fichiers Go sont exacts. Cette correction
ne revendique donc pas la parité Go/Rust pour gopurs.
Archive : `../../altbak.pub/var/benchmark/gopurs-rust-host-20261003/` ; rapport :
`../../altbak.pub/docs/benchmark-results/2026-10-03-gopurs-rust-host.md`.

**Gain majeur qualifié et installé : temps natif réduit de 52,5 % sur les
238 modules et de 53,0 % sur les 244 modules.** La confirmation principale
donne **5 447 → 2 586 ms**, 15/15 paires favorables, soit **2,11× plus rapide**.
Dans la campagne commune : **Go 2 109 ms / Rust 2 569 ms**, rapport **1,218×**
contre **2,349× avant**, soit **83,8 % de l'écart absolu résorbé**. La parité
stricte reste à atteindre ; ce lot clôt l'objectif du gain nocturne substantiel.

- JSON → Typed AST 12 modules : **116,049 → 35,351 ms** ; Go **20,003 ms**.
  Sur 238 modules : **555,096 → 175,839 ms**, Go **108,551 ms** ; décodage
  seul **449,139 → 71,161 ms**, Go **77,714 ms**. Empreintes toutes identiques.
- CPU processus **13,55 → 7,58 s (−44,1 %)** ; pic RSS **472,47 → 425,41 Mio**.
- Bootstrap **453 modules / 914 fichiers identiques**, smoke frais **152 /
  312**, 12 suites natives, 12 PBO, **90 codegen / 42 TAST**, Aff **47 checks /
  5 tests Rust / 9 erreurs**. Cinq fixtures Docker sont explicitement hors
  qualification locale ; tous leurs diagnostics disponibles sont conservés.
- Vérification finale des campagnes : **120 sorties / 54 188 fichiers exacts**.
- Stage 2 installé :
  `d170ad6a1b2b18627a70dfd873d35105b947835e03f32da998f218206cbcd703`.
  Natifs par défaut et `PURUST_JS=1` vérifiés via le launcher.
- Rapport et données :
  `../../altbak.pub/docs/benchmark-results/2026-10-03-purust-native-optimization.{md,json}`.
  Les lignes JSON, `gopurs-aff` et `purust-aff` du README sont actualisées.

## Objectif et point de départ

Viser la parité avec gopurs natif sur le TAST figé de **gopurs-aff**, en
conservant les résultats du compilateur et les sorties générées exactes.

- Campagne commune historique, 238 modules : **Go 2 146 ms / Rust 5 495 ms**,
  soit **2,56×** le temps Go.
- Dernier Rust qualifié, campagne ultérieure de 21 paires : **5 189 ms**,
  dont **635 ms de chargement TAST** et **3 135 ms d'optimisation/génération**.
  Les médianes des phases ne s'additionnent pas.
- Rejoindre l'ordre de grandeur des 2,1 secondes demanderait encore environ
  **59 % de réduction**. La parité est un objectif à démontrer par une nouvelle
  campagne commune ; ces deux campagnes distinctes ne mesurent pas un gain
  contrôlé Go/Rust actuel.
- À coût inchangé du reste du pipeline, supprimer tout le chargement TAST ne
  récupérerait qu'environ **12 %** du total. L'essentiel du gain doit donc venir
  de PBO, de la génération et de leurs représentations mémoire.

Référence native qualifiée :
`002ed7b50aaa2eb58c844fada98c715ebdaa1378ee8f62d1a23473d5f5e25639`.
Profil de départ : **O3 sans LTO, Arc, mimalloc, quatre workers PBO et quatre
workers de génération**. Le natif reste le défaut ; `PURUST_JS=1` sélectionne
explicitement JavaScript.

## Corpus et protocole communs aux lots

- [x] Figer et empreinter les compilateurs réellement utilisés, leurs sources,
      FFI, paramètres et entrées avant toute modification.
- [x] Utiliser comme corpus principal le TAST original de **gopurs-aff :
      238 modules / 136 604 types / 26 606 491 octets**. Manifeste SHA-256 :
      `6a30fb919f104df813feb7f6a884fca0a7f768e44a99f1129884d8992b832149`.
- [x] Confirmer les changements retenus sur le corpus distinct **purust-aff :
      244 modules / 138 448 types / 27 122 224 octets**. Comparer chaque corpus
      à sa propre référence.
- [x] Remesurer Go et le Rust actuel dans une même campagne pour établir la
      nouvelle référence inter-backends. Documenter les budgets de workers et
      de mémoire, ainsi que `GOGC=off` et la limite Go de 10 Gio.
- [x] Mesurer `backend total` : chargement/tri, préparation, optimisation,
      génération/émission et attente finale des workers. Exclure frontend
      `purs`, bootstrap, Cargo/Go builds, exécution applicative et démarrage/
      sortie du processus.
- [x] Employer des processus et sorties neufs, caches de compilation applicatifs
      supprimés, une chauffe puis au moins cinq mesures avec ordre tournant.
      En cas de forte variabilité, fixer le protocole de confirmation étendue
      avant de lancer ses mesures.
- [x] Séparer les profils instrumentés des chronométrages de performance.
      Rapporter médianes, moyennes, dispersion, écarts appariés, CPU, allocations
      et RSS ; distinguer octets cumulés alloués et mémoire résidente.
- [x] Exécuter les builds et campagnes longues en arrière-plan avec logs
      durables. Terminer les builds avant les mesures et éviter les compilations
      concurrentes pendant celles-ci.
- [x] Conserver tous les échantillons, empreintes, artefacts et diagnostics
      d'échec dans une nouvelle archive sous `altbak.pub/var/benchmark/`.

## Lot 1 — Réduire le travail PBO rejeté

**Premier lot à réaliser.** Les campagnes précédentes ont observé environ
65 à 73 tentatives différées pour 238 modules. Une conversion qui rencontre
une dépendance indisponible peut être achevée, rejetée, puis recommencée.
Le mécanisme existe aussi côté Go ; son poids dans l'écart reste à mesurer.

Fichier principal :
`../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/Builder.purs`.

### Diagnostic

- [x] Profiler la référence par échantillonnage, puis instrumenter les phases
      et tentatives des candidats : CPU, durée murale, allocations et dépendances
      manquantes. Le final compte 238 acceptées et zéro rejet.
- **Reporté** : mesure fine de l'occupation des workers, du chemin critique et
  de la rétention des résultats. Le défaut 4/4 et le contrôle séquentiel ont été
  comparés ; zéro conversion rejetée subsiste sur le corpus final.
- [x] Vérifier la conservation des modules encore prêts lors d'une finalisation.
      La reconstruction de `ready` dans `step` est une piste de code à tester,
      pas une cause de ralentissement déjà quantifiée.
- [x] Comparer les régimes rapides/lents et un contrôle à un seul worker pour
      distinguer coût de conversion et effets d'ordonnancement.

`attempts-ms` additionne des durées murales de tâches concurrentes : ce compteur
ne représente ni du temps CPU ni un gain récupérable directement sur le total.

### Candidats, évalués séparément

- [x] Préserver correctement l'ensemble des modules prêts et donner priorité
      aux conversions dont les dépendances sont disponibles.
- [x] Limiter les lancements spéculatifs aux références antérieures finalisées,
      en conservant les prêts et les attentes implicites. Les relances mesurées
      passent de 64–75 à zéro.
- **Reporté** : affinage dynamique des dépendances et arrêt anticipé sur
  `ExternPending`, devenus sans gain mesurable sur ce corpus sans rejets.
- [x] Conserver la visibilité par rang, les vues fixes des dépendances, les
      directives accumulées, la publication canonique et la progression en cas
      de blocage des heuristiques de dépendances.
- [x] Vérifier les cas de dépendances manquantes, réveils, relances et ordre de
      publication, puis l'identité des sorties sur les corpus figés.
- [x] Retenir chaque candidat sur son gain de compilation complète, puis mesurer
      CPU/RSS et allocations du lot et effectuer la qualification commune.

## Lot 2 — Réduire les allocations de PBO et de la génération

Le diagnostic complet du lot précédent, sur les **244 modules**, comptait
encore **660 millions de requêtes / 29,04 Go cumulés**, dont **540,5 millions
de requêtes dans optimisation/génération**. Ces chiffres historiques motivent
un nouveau profil ; ils ne constituent pas les compteurs du binaire actuel.

Cibles : les passes PBO, leurs FFI natives et
`src/Purust/CodeGen.purs`, `src/Purust/CodeGen.rs`, `src/Purust/Emission.purs`.

- [x] Réattribuer les coûts après le lot PBO : copies de chaînes, `Value`,
      boxing/unboxing, closures, dictionnaires, Maps et opérations `Arc`.
- [x] Examiner les sites chauds de `codegenExprTypeWithValueEnums`, `boxUnbox`
      et des concaténations/`joinWith`, à partir des piles mesurées.
- [x] Remplacer les copies temporaires confirmées par des emprunts sûrs dans
      les spécialisations natives des passes du compilateur.
- [x] Construire les textes dans des buffers natifs réutilisables, en conservant
      exactement les octets émis et la sémantique Unicode.
- [x] Réduire les conversions `Value`, captures et dictionnaires reconstruits
      aux sites identifiés ; conserver les garanties de partage et de concurrence.
- [x] Corriger les clés d'instanciation, vérifier possession/libération et mesurer
      le taux de succès final : 167 133 / 181 181 sondes. Les recherches de maps
      et le rendu utilisent des emprunts ; aucun cache supplémentaire introduit.
- [x] Comparer les candidats un par un sur le backend complet, réattribuer les
      allocations aux étapes utiles, puis qualifier l'ensemble retenu.

## Lot 3 — Compléter le décodage natif du TAST

Le parsing JSON isolé Rust était déjà comparable au Go. Le dernier lot a
spécialisé les tableaux et annotations ; le module complet, la validation
des faits d'usage et le chemin texte offrent encore des pistes natives.

Fichiers principaux dans le fork PBO Purust :
`CoreFn/Json.rs`, `CoreFn/Usage.rs` et `CoreFn/Json/Text.rs`.

- [x] Reprofiler les coûts restants du décodage du module et de la validation.
- [x] Spécialiser les chemins justifiés de `decodeModuleImpl` et de validation
      des faits d'usage, avec la référence PureScript comme oracle.
- **Reporté au prochain lot** : chemin texte direct inspiré du curseur Go,
  évitant l'arbre JSON intermédiaire. Le diagnostic final montre que le
  décodage seul atteint Go, mais que le chemin texte complet garde une marge.
- [x] Préserver les valeurs, le partage des types, les règles numériques,
      les optionnels absents/`null`, Unicode et la structure/priorité des erreurs.
- [x] Réutiliser les tests différentiels et oracles des corpus 12 et 238 modules ;
      mesurer séparément parse, decode, combined et destruction finale, avec
      les empreintes calculées hors chronométrage.
- [x] Refaire explicitement **JSON → Typed AST Go/Rust**, demandé avant la nuit,
      sur les mêmes entrées et avec l'oracle de fingerprints ; mettre à jour
      sa ligne dans `altbak.pub/README.md` après qualification.
- [x] Confirmer le gain sur le chargement et sur le compilateur complet, puis
      effectuer la qualification commune.

## Lot 4 — Recaler le parallélisme

À réaliser après réduction du travail et des allocations : la meilleure
répartition peut changer lorsque le coût des passes évolue.

- [x] Comparer les budgets PBO/génération autour du défaut quatre + quatre,
      avec un contrôle séquentiel et des budgets bornés adaptés à la machine.
- [x] Mesurer les temps totaux, budgets effectifs et tentatives rejetées pour
      chaque configuration, puis CPU/RSS et allocations pour le défaut retenu.
      Les diagnostics de ressources détaillés par configuration sont reportés.
- [x] Utiliser les comparaisons à budget comparable pour le diagnostic et
      publier les réglages de production effectivement retenus.
- [x] Vérifier propagation des erreurs, fin des workers et durée de vie des
      tâches enfants, puis qualifier les réglages retenus.

## Qualification et publication de chaque lot retenu

- [x] Comparer exactement les sources et manifests générés à la référence
      de chaque cible et corpus, y compris entre exécution JS et native.
- [x] Exécuter les régressions codegen/PBO/runtime pertinentes et les tests
      différentiels des chemins spécialisés.
- [x] Exécuter la suite Aff complète, les scénarios d'erreur, Ref/AVar et les
      tests de durée de vie des enfants. Pour gopurs-aff, conserver la validation
      applicative synchronisée séparée du TAST original chronométré.
- [x] Qualifier l'auto-reconstruction **JS → stage 1 natif → stage 2 natif →
      smoke dans un projet frais** et vérifier les sorties JS/native attendues.
- [x] Mesurer le stage 2 qualifié, relier son empreinte aux résultats et vérifier
      l'identité du binaire installé.
- [x] Publier les résultats avant/après et la comparaison Go/Rust commune,
      avec les échantillons bruts, paramètres et résultats de qualification.
- [x] Actualiser ce plan et les tableaux de performance avec les seuls gains
      établis sur les corpus correspondants.

## Références et outils

- Comparaison commune Go/Rust :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-gopurs-aff-go-rust-compilation.{md,json}`.
- Dernier lot TAST et stage 2 qualifié :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-rust-json-typed-ast.{md,json}`.
- Diagnostic historique du pipeline et des allocations :
  `../../altbak.pub/docs/benchmark-results/2026-10-02-purust-pipeline-optimization.{md,json}`.
- Harness : `../../altbak.pub/bin/benchmark/gopurs-aff/`,
  `../../altbak.pub/bin/benchmark/purust-tast/` et `tools/`.
- Corpus principal et référence Go :
  `../../altbak.pub/var/benchmark/gopurs-purust-aff-20261002/`.
- Corpus 244 figé :
  `../../altbak.pub/var/benchmark/purust-pipeline-20261002/reference/`.
- Dernières mesures, diagnostics et qualification :
  `../../altbak.pub/var/benchmark/purust-tast-20261002/`.

## Journal de la campagne nocturne

Archive : `../../altbak.pub/var/benchmark/purust-pbo-20261002/`.

- Référence native `002ed7b5…`, bundle JS, sources Purust/PBO et frontend
  copiés et empreintés. Le harness accepte désormais une référence native
  récente explicitement liée à sa qualification stage 2.
- Contrôle A/A, trois paires après chauffe sur les 238 modules : le même
  exécutable donne **5 627 / 5 599 ms** de médiane ; les six mesures s'étendent
  de **5 145 à 5 881 ms**. Les huit sorties sont byte-identiques à l'oracle.
  Cette variabilité impose des comparaisons appariées suffisamment longues.
- Audit parallèle de l'ordonnanceur et des spécialisations natives de génération.
  Profils du binaire actuel conservés dans `profile-baseline*` ; leurs durées
  instrumentées sont exclues des gains publiés.
- Ordonnanceur C1+C2+C3 : conserve les anciens prêts, exclut ceux encore en
  attente d'une dépendance implicite et filtre le repli sur les références
  antérieures non finalisées. Les quatre nouvelles régressions passent ; les
  sept suites PBO passent. Première campagne cinq paires : **4 752 → 4 300 ms**
  (**−9,5 %**), sorties identiques, **63–71 rejets → zéro** sur 238 modules.
- Le cache d'instanciation utilisait l'identité de l'enveloppe `Any` reconstruite
  à chaque appel. La clef native reconnaît désormais l'arbre immuable partagé
  `ExprType`/`BackendSyntax`, dont les propriétaires restent retenus par le cache.
  Campagne commune cinq tours : référence **5 385 ms**, ordonnanceur **4 490 ms**,
  ordonnanceur + cache **4 310 ms** ; les 18 sorties sont exactes. Soit **−4,0 %**
  marginal au cache et **−20,0 %** cumulé dans cette campagne, encore expérimentaux.
- Diagnostic séparé ordonnanceur + cache : **238 tentatives acceptées, zéro rejet**,
  CPU de conversion cumulé **3,452 s**, **135 348 932 allocations** de conversion.
  Caches : **167 133 succès / 181 181 sondes**. Total compilateur instrumenté :
  **472 405 467 requêtes / 22 762 927 514 octets cumulés**, dont préparation
  **13 153 622 / 4 013 855 244** et finalisation **42 183 323 / 1 592 334 193**.
  Ce sont des compteurs d'allocation, pas la mémoire résidente.
- Le rendu natif de types est construit ; tests différentiels puis mesure en
  cours. La substitution native a été livrée pour revue. Le décodage natif du
  module TAST et l'audit de préparation/préambule se poursuivent en parallèle.
- Trois essais de construction isolée ont été conservés : échecs de plomberie
  du lien source puis du chemin des templates runtime, corrigés avant le premier
  binaire mesuré. Chaque candidat possède désormais ses sources et son bundle
  propres ; le cache Cargo commun conserve les mtimes des fichiers inchangés.
- Rendu natif validé : **136 604 types**, **409 812 comparaisons corpus**,
  **948 cas synthétiques** et **7 sondes de délégation**. Les cinq modules sans
  entrée de table de types sont comptés dans le corpus de 238 mais n'ajoutent
  pas de comparaison de type. Campagne cinq tours : référence **5 136 ms**,
  ordonnanceur + cache **4 069 ms**, ajout du renderer **3 827 ms** : **−5,95 %**
  marginal et **−25,49 %** cumulé. Les 18 sorties restent exactes.
- Tests renderer : échec disque plein puis défaut du harnais d'injection FFI
  (remplacement JS interprétant `$'` et prenant le marqueur d'un commentaire),
  tous deux conservés et corrigés. Cache Cargo historique de `build-layout/
  rust-stage2` supprimé après copie/empreinte de ses trois exécutables ; sources
  et logs historiques conservés. Le test différentiel complet passe ensuite.
- Le nouveau harness `compare-json.py` prépare la mesure commune Go/Rust avant/
  après sur 12 et 238 modules : corpus/oracles figés, trois processus par variante,
  ordre des runtimes et des phases tournant, deux chauffes et cinq échantillons
  par phase, destruction Rust enregistrée séparément.
- Substitution `ExprType` native : **48 cas ciblés / 4 000 aléatoires** passent,
  toutes les sorties restent identiques. Première comparaison non concluante :
  renderer **3 990 ms**, ajout substitution **4 126 ms**, avec un échantillon à
  **5 671 ms**. Aucun gain marginal n'est revendiqué ; la sélection finale reste
  ouverte. Les compteurs de conversion baissent de **135,35 à 124,12 millions**
  de requêtes ; avec le renderer, le total passe de **472,41 à 419,95 millions**.
- Profil actualisé après renderer/substitution : famille substitution **178 /
  7 816 échantillons** contre **1 924 / 12 091** dans la référence. Le cache
  corrigé a changé les priorités ; un vaste port supplémentaire des expressions
  neutres doit être justifié par ce nouveau profil.
- Nouvelle cause de préparation identifiée : **477 échantillons** de compilation
  regex viennent du lexer CST appelé par `Directives.parseDirectiveLine`, dont
  **469** sous `App.loadDirectives`. Les directives par défaut passent donc à
  un petit parseur natif ASCII conservateur ; le parseur PS reste l'oracle et
  reçoit intégralement les autres syntaxes/erreurs. Construction réussie ; tests
  différentiels des lignes par défaut, cas générés et délégation en cours.
- Directives : **169 lignes par défaut / 352 cas valides générés / 33 sondes de
  délégation exacte** passent, ainsi que les tests natifs de cache. Campagne cinq
  tours : référence **5 221 ms**, renderer **4 144 ms**, ajout directives **3 629 ms**
  (**−12,4 %** marginal, **−30,5 %** cumulé). Préparation **633 → 65 ms** ; les
  18 sorties sont exactes. Ce candidat part du renderer et n'inclut pas la
  substitution dont le gain reste indécis.
- Le profil courant attribue encore un coût important à `boxUnbox`. Un candidat
  prend en charge les représentations identiques, gardes et conversions scalaires
  dans un buffer natif ; fonctions/classes restent traitées par une référence PS
  récursive indépendante. Construction et tests différentiels en cours.
- `boxUnbox` : **2 028 comparaisons scalaires/gardes / 60 cas fonctions et ADT**,
  et conservation du buffer d'un mégaoctet passent. Nouveau contrôle renderer
  corpus également réussi. Campagne cinq tours : directives **3 511 ms**, ajout
  box/unbox **3 434 ms**, référence **5 002 ms** : gain marginal **2,2 %**, cumulé
  **31,3 %**. Le gain marginal modeste devra être confirmé dans la sélection finale.
- Nouveau candidat champs : `rawFieldKeywords` et `unrawableFieldKeywords` sont
  reconstruits par les getters PS à chaque test de mot-clef. Les chemins natifs
  `fieldBase`/`recordFieldIdent` empruntent la map de renommage et utilisent une
  classification statique des mots-clefs. Construction en cours ; tests
  différentiels dédiés confiés à l'agent de génération.
- Le port natif de validation des faits d'usage du TAST est lancé séparément du
  décodage : il représente encore **260 échantillons** du profil actuel. Les
  messages et l'ordre de validation, masquage lexical et identités globales
  doivent rester identiques à la référence PS.
- Champs : campagne cinq tours, box/unbox **3 434 ms**, ajout noms de champs
  **3 242 ms** (**−5,6 %**, favorable dans les cinq tours), référence **5 403 ms**.
  La finalisation baisse de **669 à 511 ms**. Les 18 sorties sont identiques.
  Les tests sémantiques dédiés restent requis avant sélection définitive.
- Canonicalisation des noms `Record_*` : nouveau chemin natif tri/déduplication
  des labels originaux, renommage par emprunt et tampon unique. L'oracle conserve
  explicitement les cas `Record_a` / `ClosedRecord_a`. Construction en cours,
  avec tests de collisions, ordre, doublons, noms vides et Unicode prêts.
- Noms de records : **1 032 cas exacts / deux replis**, puis campagne cinq tours
  **3 180 → 2 918 ms** (référence **5 210 ms**) ; finalisation **510 → 235 ms**.
- Validation source-usage : les **238 modules** et toutes les branches/cas
  synthétiques passent après correction d'un constructeur de fixture `ExprLet`
  (un `Bind` doit être contenu dans un tableau). Aucun module n'est filtré.
  Campagne cinq tours : records **2 866 ms**, ajout validateur **2 613 ms**, référence
  **5 228 ms** ; gain marginal **8,8 %**, total **50,0 %**. Chargement/tri
  **621 → 337 ms**. Les 18 sorties restent exactes.
- Protocole de confirmation pré-déclaré dans `confirmation-protocol.json` :
  sélection des effets marginaux indécis sur 15 tours, workers 4/4, 3/5, 2/6,
  6/2 et contrôle 1/1, confirmation stage 2 15 paires + corpus 244 sept tours,
  comparaison commune Go/Rust dix tours ; JSON 12/238 trois processus chacun.
- Substitution confirmée sur 15 tours : **2 608 → 2 590 ms**, médiane des écarts
  **−16 ms**, 11/15 favorables. **0,7 %** marginal ne justifie pas la complexité
  de ce port : il est écarté du lot de production, avec sources/tests/binaires
  et mesures conservés dans l'archive expérimentale.
- Le premier balayage des workers avait mal interprété `PURUST_PBO_JOBS` : il
  désigne le **budget total**, dont on retranche la génération concurrente. Les
  fichiers et résultats `workers-exploration` sont conservés mais ne mesurent
  pas les répartitions annoncées. Les nouveaux `workers-v2-*` fixent le budget
  à **8** et la génération à **4/5/6/2**, soit PBO **4/3/2/6** ; le contrôle 1/1
  reste séquentiel. Vérifier les compteurs `PBO jobs/codegen-jobs/budget` des logs.
- Balayage corrigé, trois tours : **4/4 = 2 637 ms**, **3/5 = 2 668 ms**,
  **2/6 = 2 972 ms**, **6/2 = 2 965 ms**, contrôle séquentiel **5 955 ms**.
  Les budgets réels sont vérifiés dans chaque log ; les 24 sorties sont exactes.
  Le défaut **4/4** est retenu. Les gains du lot ne reposent donc pas sur une
  augmentation du budget de workers.
- Module TAST natif construit après correction d'une durée de vie Rust dans
  `foreignAnnotations`. Test différentiel : **238 modules entièrement natifs**,
  **10 frontières valides**, **2 erreurs de validation**, **39 replis exacts** ;
  spans de module et partage des entrées de types conservés.
- Noms de champs : **100 labels / 150 maps / 61 600 comparaisons** passent sans
  recours à l'oracle. Les deux échecs du harnais sont conservés : imports absents,
  puis permutation de clés dupliquées changeant les valeurs last-write-wins.
  Le test permute désormais un ensemble de clés uniques à contenu identique.
- Les anciens harnais annotations/table de types injectent tout `Json.rs` :
  ajout de leurs dépendances/imports pour les helpers froids du module, puis
  relance ciblée de ces deux suites. Les suites module/champs/usage passent déjà.
- Port `TypeSubstitution` archivé dans `rejected-substitution` avec empreintes ;
  sources de production restaurées exactement et tests expérimentaux conservés
  dans l'archive. Aucun port des expressions neutres n'a été engagé.
- Gel de sélection : le contenu `src/` vivant est identique à celui du candidat
  mesuré `module-v2`. Cinq tours donnent **4 622 / 2 507 / 2 404 ms** pour la
  référence, le validateur d'usage et le décodeur de module cumulés. Le décodeur
  gagne **103 ms** supplémentaires ; toutes les sorties restent exactes.
- JSON → AST, 12 modules : trois processus par variante, deux chauffes et cinq
  échantillons par phase, empreintes JSON/AST vérifiées. Médianes des minima par
  processus : décodage **Go 11,606 / Rust avant 93,914 / après 13,823 ms** ;
  combiné **20,003 / 116,049 / 35,351 ms**. Campagne 238 modules lancée avant le
  bootstrap ; les sources PBO du diagnostic seront liées au gel de qualification.
- L'ancien cache Cargo expérimental a été supprimé après copie et vérification
  des empreintes des exécutables. Sources, sorties et diagnostics conservés.
- JSON 238 terminé : toutes les empreintes concordent. Décodage **Go 77,714 /
  Rust avant 449,139 / après 71,161 ms** ; chemin complet **108,551 / 555,096 /
  175,839 ms**. Le décodage Rust est divisé par **6,31**, le chemin complet gagne
  **68,3 %**. Go garde son avantage sur le chemin texte direct ; les phases
  indépendantes ne s'additionnent pas.
- Avant le bootstrap, confirmation 15 tours du petit effet marginal `boxUnbox`
  lancée avec les exécutables figés (la première série avait trois gains,
  une égalité et un écart défavorable de 1 ms). Cette vérification clôt la
  réserve de sélection notée plus haut.
- Confirmation `boxUnbox` : **3 336 → 3 293 ms**, médiane marginale appariée
  **−41 ms**, **14/15 paires favorables**. Le petit gain est retenu ; les 48
  sorties de cette confirmation restent exactes.
- Bootstrap : stage 1 construit et sources stage 1/stage 2 identiques ; échec
  réseau Cargo au lancement du build stage 2 (`index.crates.io` introuvable).
  Rapport d'échec conservé sous `qualification/qualification-network-failure.json`.
  Reprise hors ligne du stage 2 comparé, avec revérification du gel des sources,
  des empreintes, de l'identité des sorties et nouveau smoke complet.
- Reprise réussie : **453 modules / 282 637 types**, **914 fichiers compiler
  identiques**, stage 2 **`d170ad6a…cbcd703`** ; smoke frais **152 modules /
  312 fichiers identiques**, application vérifiée. Les régressions natives,
  PBO, codegen/TAST et Aff s'enchaînent avant les mesures du stage 2.
- Les **12 suites natives** et **12 suites PBO** passent sur le stage 2 final.
  La première passe codegen donne **88/94** : quatre fixtures b8x demandent un
  Docker indisponible, deux fixtures standalone doivent limiter/adapter leurs
  dépendances aux nouveaux chemins natifs. Ces deux fixtures sont corrigées ;
  les quatre tests Docker et le TAST crypto Docker sont explicitement consignés
  hors qualification hôte. Régressions portables relancées, puis Aff complète.
- Codegen portable : **90/90** passent après correction des deux fixtures,
  incluant **133 148 cas de sanitizer** et **63 assertions FFI JS/Rust**.
- Régressions TAST : **42/42** passent. Aff finale : **47 checks, cinq tests
  Rust, neuf scénarios d'erreur**, Ref/AVar et durée de vie des enfants passent.
  La campagne chronométrée du stage 2 qualifié est lancée : 15 paires 238,
  sept tours 244, dix tours communs Go/Rust, puis CPU/RSS et allocations séparés.
- Confirmation du stage 2 sur 238 modules : **5 447 → 2 586 ms (−52,5 %)**,
  **15/15 paires favorables**, écart médian apparié **−2 838 ms**. Moyennes
  **5 310,5 → 2 560,2 ms (−51,8 %)** ; les **32 × 484 fichiers** sont exacts.
- Corpus 244 : **5 604 → 2 632 ms (−53,0 %)**, JS actuel **6 389 ms** ;
  **24 × 496 fichiers** identiques. Sept mesures par variante après chauffe.
- La chauffe Go/JS de la comparaison commune a détecté un défaut de copie du
  harnais : `tools/ffi-runner.mjs` avait été placé sous `bin/tools`. Copie corrigée
  de l'installation Go figée complète (`bin`, `tools`, `package.json`) avec
  empreintes ; première chauffe conservée dans `common-go-rust`, nouvelle
  campagne complète dans `common-go-rust-final`. Les campagnes Rust passent.
- Comparaison commune finale, dix tours : **Go JS 7 750 ms / Go natif 2 109 ms /
  Purust JS 6 208 ms / Rust avant 4 954 ms / Rust final 2 569 ms**. Rapport
  Rust/Go **2,349× → 1,218×**, écart absolu **2 845 → 460 ms (−83,8 %)**.
  Gain Rust de cette campagne **48,1 %** ; la variabilité du témoin explique
  l'écart avec les 52,5 % de la confirmation primaire. Les **55 sorties** sont
  exactes (22 Go × 294 fichiers, 33 Rust × 484 fichiers).
- Logs primaires : budgets **4/4, total 8** vérifiés dans tous les passages ;
  **64–75 conversions rejetées avant, zéro après**. Le diagnostic CPU/RSS a
  détecté un parent `generated/` manquant dans son harnais ; premier échec
  conservé et reprise fraîche sous `resources-final-v2` après correction.
- Diagnostics finaux réussis : CPU **13,55 → 7,58 s**, RSS **472,47 → 425,41 Mio**.
  Compilateur instrumenté **339 694 649 allocations / 15,805 Go cumulés**,
  **238 conversions acceptées / zéro rejet**. Sources générées et exécutable
  stage 2 restaurés et empreintés après instrumentation.
- JSON allocations 238 : décodage **35 113 805 → 4 096 136 (−88,3 %)** ;
  combiné **41 082 523 → 10 064 854 (−75,5 %)**. Empreintes JSON/AST vérifiées.
- Contrôle préalable à l'installation réussi : **120 sorties / 54 188 fichiers**
  revérifiés, échantillons confrontés aux logs, tests/sources/binaires empreintés.
  Installation atomique du stage 2 **`d170ad6a…cbcd703`**, ancien binaire archivé ;
  les lancements natif par défaut et JS explicite passent.
- README mis à jour avec la comparaison Go/Rust commune et les résultats JSON
  12 modules ; rapport détaillé séparé avec les résultats 238/244, ressources,
  protocoles et diagnostics. Les commentaires retirés sous les deux tableaux
  de compilation restent absents. Aucun commit ni push effectué.
- Publication vérifiée après installation : **120 sorties / 54 188 fichiers**,
  hash installé et valeurs du README confrontés au JSON publié ; liens et
  syntaxe des harnais vérifiés. `git diff --check` passe dans les trois dépôts.
- Nettoyage final de **19 caches Cargo de tests terminés**, après conservation
  empreintée de **121 chemins exécutables** ; sources et logs conservés.
- Les deux sondes de launcher avec `--help` ont révélé que cette option n'est
  pas implémentée : elles ont généré `Main` avec succès dans la sortie par défaut.
  Ces exécutions supplémentaires ne sont pas des mesures de benchmark ; leurs
  sorties et caches sont archivés sous `launcher-probe-artifacts`, puis le cache
  `.purmeta` suivi, propre avant les sondes, est restauré.
