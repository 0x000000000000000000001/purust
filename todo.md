# Roadmap d'Optimisation pour purust (Backend Rust)

L'objectif de cette roadmap est de transformer `purust` d'un générateur dynamique (façon JavaScript) à un générateur typé et performant, en s'inspirant des techniques développées pour `gopurs` via le TAST (`tcorefn`).

## Éradiquer le "God Struct" (`Record_a`) et le Virtual Dispatch (Priorité Absolue)
**Constat (Benchmarking empirique) :** L'approche actuelle utilise un énorme struct global `Record_a` (~280 champs) pour chaque record anonyme. L'exécution de `AstTree` (Knot-tying `LetRec`) fonctionne à présent à 100%, mais les benchmarks (notamment Red-Black Tree avec ~2000 ms) mettent en évidence l'étranglement de l'allocateur mémoire dû à l'utilisation intensive de tableaux dynamiques génériques (`Value::Array`) pour stocker les ADT et à la désactivation temporaire de la réutilisation mémoire.

### Prochaines étapes (Explosion des performances) :
- [x] **Step 1 (Enums Natifs pour ADTs) :** Utiliser les métadonnées de `dataDecls` (fournies par le TAST) pour générer des `enum` Rust structurés et stricts, remplaçant la sérialisation systématique dans des `Value::Array`. C'est la prochaine étape pour effondrer le temps d'exécution des arbres (Red-Black Tree, AST).
- [ ] **Step 2 (Structs Natifs pour Type Classes) :** Utiliser les métadonnées de `classDecls` pour générer des `structs` Rust spécifiques et isolés pour les dictionnaires de classes de types (évite la pénalité de résolution de clés).
- [ ] **Step 3 (Records Anonymes) :** Remplacer le `Record_a` par des structs spécifiques pour les records anonymes purs (générés dynamiquement selon les types de row utilisés dans le programme).
- [ ] **Step 4 (Unboxing des Closures) :** Remplacer les `Rc<dyn Fn>` par des fonctions natives, inlinées ou des pointeurs statiques lorsque c'est possible. Le recours au `Rc<dyn Fn>` (et donc à la heap) doit être l'exception, et non la règle.

Note : tu peux tester à la fin de tes travaux si tout fonctionne avec bin/rust/run -c, dans altbak.pub
