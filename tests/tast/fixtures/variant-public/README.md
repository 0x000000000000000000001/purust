# Variant public

`tests/tast/variant-public.mjs` compile les vraies sources de la bibliothèque
avec un TAST frais et compare treize groupes JS. La suite native qualifiée
contient douze tests, en normal/threaded. Utiliser `PURS` pour sélectionner le
fork et `PURUST_VARIANT_PUBLIC_KEEP_OUTPUT` pour conserver les exports.

Le treizième contrat, `unvariant`/`revariant`, reste volontairement une sonde
séparée, **non qualifiée** : il doit préserver le payload, mais échoue actuellement
sur `Expected Unit`. Ce n'est ni un test ignoré ni un panic attendu.

Dans chaque export conservé (`normal` ou `threaded`), le reproduire avec :

```sh
cargo test --offline --locked --target-dir ../unvariant-cache-normal \
  -p Purs_VariantPublicProbe --example unvariant
```

Utiliser un autre `--target-dir` pour chaque export et pour threaded. Le code de
sortie non nul est l'échec réel du contrat. `cargo test --tests` ne lance pas cet
exemple. Les autres opérations publiques non exercées ne sont pas qualifiées.

Les gardes b8x se vérifient ensuite sur des copies avec
`run/bak/rust/tests/variant-public-guard.mjs <rapport-conservé>/report.json`.
