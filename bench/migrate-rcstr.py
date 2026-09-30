#!/usr/bin/env python3
"""Mechanical `Value::String` migration for the Rc<str> runtime.

Run from `htdocs/purust` (the directory holding every `purust-*` port) after
switching the runtime to `Value::String(Rc<str>)`. Two passes:

1. convert non-trivial construction arguments:
   `Value::String(X)` -> `Value::String((X).into())`;
   bare bindings, `ref` bindings, wildcards and already-converted arguments are
   skipped;
2. convert bare *value* arguments (`Value::String(v)`) when the following token
   is not a pattern context (`=` / `=>` / `|`).

The compiler then points at the remaining match sites (a bound `Rc<str>` passed
where a `String` is expected), fixed by hand with `.to_string()`.

Measured on the JSON decoding benchmark: decode 4410 -> 4180 microseconds and
combined 6929 -> 6832; the remaining ~15 ports matter for the b8x closure only.
"""
import re
from pathlib import Path


def convert(text, bare_values):
    out = []
    i = 0
    changed = 0
    while True:
        m = re.search(r'(crate::Value::String|Value::String)\(', text[i:])
        if not m:
            out.append(text[i:])
            break
        start = i + m.start()
        arg_start = i + m.end()
        depth = 1
        j = arg_start
        while depth and j < len(text):
            if text[j] == '(':
                depth += 1
            elif text[j] == ')':
                depth -= 1
            j += 1
        arg = text[arg_start:j - 1]
        trimmed = arg.strip()
        skip = (
            re.fullmatch(r'(ref\s+)?[A-Za-z_][A-Za-z0-9_]*', trimmed) is not None
            or trimmed == '_'
            or trimmed.endswith('.into()')
        )
        if skip and bare_values and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', trimmed):
            rest = text[j:j + 6].lstrip()
            is_pattern = rest.startswith('=') or rest.startswith('=>') or rest.startswith('|')
            if not is_pattern:
                out.append(text[i:start] + m.group(1) + '(' + trimmed + '.into())')
                i = j
                changed += 1
                continue
        if skip:
            out.append(text[i:j])
            i = j
            continue
        out.append(text[i:start] + m.group(1) + '((' + arg + ').into())')
        i = j
        changed += 1
    return ''.join(out), changed


def main():
    total = 0
    for port in sorted(p for p in Path('.').glob('purust-*') if (p / 'src').is_dir()):
        for path in (port / 'src').rglob('*.rs'):
            try:
                text = path.read_text()
            except OSError:
                continue
            if 'Value::String(' not in text:
                continue
            text, changed = convert(text, bare_values=False)
            text, more = convert(text, bare_values=True)
            if changed + more:
                path.write_text(text)
                total += changed + more
    print('sites converted:', total)


if __name__ == '__main__':
    main()
