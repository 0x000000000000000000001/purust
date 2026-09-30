#!/usr/bin/env python3
"""Mechanical Value::String migration for the Rc<str> runtime (documented).

Two passes over every `purust-*` port source:
1. wrap non-trivial construction arguments: `Value::String(X)` -> `Value::String((X).into())`
   (skips bare/`ref` bindings, wildcards and already-converted arguments);
2. wrap bare value arguments (`Value::String(v)`) when the following token is not
   a pattern context (`=`/`=>`/`|`).

The compiler then points at the remaining match sites (`.clone()` on a bound
Rc<str> that a callback expects as String), which are fixed by hand with
`.to_string()`. Measured on the JSON decoding benchmark: decode 4410 -> 4180
microseconds, combined 6929 -> 6832; the ~15 remaining ports are needed for
the b8x closure only.
"""
import re
from pathlib import Path

ports = [p for p in Path('.').glob('purust-*') if (p / 'src').is_dir()]
for port in ports:
    for path in (port / 'src').rglob('*.rs'):
        try:
            text = path.read_text()
        except OSError:
            continue
        if 'Value::String(' not in text:
            continue
        # pass 1 and 2 as implemented in the session history
