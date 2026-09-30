# Outillage de mesure purust

- `paired.py` — exécute un binaire JSON (et éventuellement les binaires Go/C
  préservés) sur les six permutations de phases, valide les empreintes de
  l'oracle et imprime les médianes par phase. C'est le protocole des cellules
  publiées.
- `instrument.py` — instrumente un workspace construit par le harnais : le
  binaire compte ses allocations par passe (`allocs`, `bytes`, `us`) et sait
  ventiler par cas de corpus. Le workspace est régénéré par le harnais à la
  prochaine construction, donc le patch est sans effet durable.

Exemples :

```
python3 bench/paired.py --workspace ../altbak.pub/var/benchmark/json-decoding-rs4 \
  --corpus ../altbak.pub/test/fixtures/json-decoding/corpus.json \
  --go /chemin/benchmark-go --c /chemin/benchmark-c

python3 bench/instrument.py --workspace ../altbak.pub/var/benchmark/json-decoding-rs4 \
  --purust bin/purust --corpus ../altbak.pub/test/fixtures/json-decoding/corpus.json \
  --single-cases /tmp/json-single
```

- `backtrace-main.rs` + `aggregate-bt.py` — échantillonnage borné des
  backtraces d'allocation : remplacer l'allocateur généré par le gabarit,
  compiler avec `CARGO_PROFILE_RELEASE_DEBUG=true`, lancer avec
  `DIAG_BT_START`/`DIAG_BT_COUNT`/`DIAG_BT_OUT`, puis agréger les sites.
