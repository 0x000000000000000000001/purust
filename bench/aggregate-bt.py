#!/usr/bin/env python3
"""Aggregate allocation backtraces captured by the counting allocator.

usage: aggregate-bt.py FILE
"""
import re
import sys
from collections import Counter

INFRA = (
    'std::backtrace', 'maybe_capture', 'GlobalAlloc', 'alloc::alloc', '__rust',
    'mi_', 'malloc', 'malloc_zone', 'std::alloc::', 'alloc::raw_vec',
)

path = sys.argv[1]
blocks = []
current = None
for line in open(path, errors='replace'):
    if line.startswith('=== alloc '):
        if current:
            blocks.append(current)
        current = []
        continue
    match = re.match(r'\s+\d+:\s+(.+)$', line.rstrip())
    if match and current is not None:
        current.append(match.group(1))
blocks.append(current)

leaf = Counter()
caller = Counter()
for frames in blocks:
    useful = [f for f in frames if not any(i in f for i in INFRA)]
    if useful:
        leaf[useful[0]] += 1
        purs = next((f for f in useful if 'Purs_' in f or 'purust_core::' in f), useful[0])
        caller[purs] += 1

print(f'{len(blocks)} backtraces\n')
print('--- top leaf allocation sites ---')
for name, count in leaf.most_common(15):
    print(f'{count:5}  {name[:140]}')
print('\n--- top user callers ---')
for name, count in caller.most_common(15):
    print(f'{count:5}  {name[:140]}')
