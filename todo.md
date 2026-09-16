# Vision : Le pouvoir est dans le Frontend (Haskell)

La stratégie ultime pour optimiser `purust` n'est pas d'alourdir le générateur Rust avec des inférences complexes, mais d'**enrichir le TAST (`tcorefn`) directement dans le compilateur PureScript (Haskell)**. Le backend `purust` doit rester "bête" et se contenter de traduire les métadonnées.

En modifiant le fork Haskell (`htdocs/purescript`), on peut ajouter des métadonnées cruciales dans la propriété `ann` de l'AST :

1. **`ann.usageCount` (Le plus rentable) :** Une passe d'analyse en Haskell qui compte les lectures d'une variable. Si `usageCount == 1`, `purust` génère un *Move* Rust (transfert d'Ownership `T`) au lieu d'un `Rc::clone()`.
2. **`ann.escapes` (Analyse d'échappement) :** Le compilateur détermine si un argument est capturé ou retourné. S'il ne "fuit" pas de la fonction, `purust` génère un emprunt statique `&T`. Le Borrow Checker valide tout sans coût.
3. **`ann.lifetime` (Inférence de Régions) :** Modification plus avancée où le Type Checker Haskell infère des régions mémoire (ex: Tofte-Talpin). `purust` associe ça directement à des *lifetimes* Rust (`'a`) et des allocateurs par Arène.

---

## Optimisations de la mémoire (Réduction des `Rc<>`)

Ce document liste les stratégies architecturales pour réduire ou éliminer l'utilisation intensive de `std::rc::Rc` par le compilateur `purust`.

### 1. Passage par copie (Value Semantics) pour les types simples
Le TAST (`tcorefn`) possède la connaissance exacte de la structure mémoire des types.
- **Action :** Pour les petits types (Int, Boolean, petits ADTs statiques, petits records), `purust` peut dériver le trait `Copy` en Rust.
- **Résultat :** Les variables sont passées par valeur pure sur la pile (stack). Zéro allocation sur le tas, zéro `Rc`.

### 2. Analyse d'usage unique (Ownership / Move Semantics)
En PureScript, beaucoup de variables intermédiaires sont "consommées" immédiatement. L'implémentation naïve actuelle avec `Rc` entraîne un incrément suivi d'un décrément immédiat.
- **Action :** Ajouter une analyse statique (ou comptage d'usage) sur l'AST généré. Si une variable n'est lue qu'une seule fois dans la fonction, `purust` doit utiliser le système d'Ownership de Rust (transfert direct `T`) au lieu de cloner la référence.
- **Résultat :** Code "bare-metal" naturel pour les flux de données linéaires.

### 3. Inférence d'emprunt (Borrowing - `&T`)
La majorité des fonctions pures font de la lecture seule (projection, accumulation) et ne stockent pas leurs arguments dans une structure qui survit à l'appel.
- **Action :** Implémenter une analyse d'échappement (Escape Analysis). Si l'argument ne "fuit" pas (pas de closure, pas de stockage long terme), générer la signature Rust avec une référence `&T` au lieu de `Rc<T>`.
- **Résultat :** Le Borrow Checker fait le travail statiquement, aucun coût au runtime. Gain de performance critique.

### 4. Allocation par Arène (Arena Allocation)
Pour les structures arborescentes très partagées créées par lots (ex: création d'un Virtual DOM, construction d'un AST).
- **Action :** Intégrer un système d'arène (ex: `bumpalo`). Toute l'arborescence est allouée dans un bloc mémoire contigu avec une durée de vie globale `'a`. Les nœuds utilisent `&'a T` au lieu de `Rc<T>`.
- **Résultat :** Zéro désallocation individuelle. Destruction O(1) de l'arène complète à la fin du cycle.

---
**Verdict architectural :**
L'usage de `Rc<>` par défaut est la meilleure approche pragmatique pour amorcer le compilateur (exactement comme le fait Fable vers Rust pour F#). Vouloir 0% de `Rc` demanderait d'embarquer un moteur d'inférence de *lifetimes* aussi complexe que celui de Rust. 

La priorité devrait être (1) et (2) grâce à la puissance du TAST pour éliminer les `Rc` sur les types primitifs et les variables intermédiaires simples.
