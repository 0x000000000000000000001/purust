// PureScript omits foreign data declarations from dataDecls. Read only these
// opaque declarations from the original source, never infer an ADT layout.
function declarations(source) {
  let clean = '', i = 0;
  while (i < source.length) {
    if (source.startsWith('--', i)) {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (source.startsWith('{-', i)) {
      i += 2; let depth = 1;
      while (i < source.length && depth) {
        if (source.startsWith('{-', i)) { depth++; i += 2; }
        else if (source.startsWith('-}', i)) { depth--; i += 2; }
        else { if (source[i] === '\n') clean += '\n'; i++; }
      }
    } else if (source[i] === '"') {
      const triple = source.startsWith('"""', i); i += triple ? 3 : 1;
      while (i < source.length) {
        if (triple && source.startsWith('"""', i)) { i += 3; break; }
        if (!triple && source[i] === '"') { i++; break; }
        if (!triple && source[i] === '\\') i++;
        if (source[i] === '\n') clean += '\n';
        i++;
      }
      clean += ' ';
    } else { clean += source[i++]; }
  }
  return [...clean.matchAll(/^foreign\s+import\s+data\s+([A-Z][\w']*)\b/gm)].map(m => m[1]);
}

function nativeDefinition(rust, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('\\b(?:struct|enum|type|trait)\\s+' + escaped + '\\b').test(rust)) return true;
  for (const match of rust.matchAll(/\bpub\s+use\s+([^;]+);/g)) {
    const names = match[1].replace(/[{}]/g, '').split(',').map(part => part.trim().split(/\s+as\s+|::/).at(-1));
    if (names.includes(name)) return true;
  }
  return false;
}

export const foreignTypeForwards = source => rust => declarations(source)
  .filter(name => !nativeDefinition(rust, name))
  .map(name => {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) throw new Error('Unqualified foreign type identifier: ' + name);
    return '// Opaque FFI declaration only: no native values can be constructed.\n' +
      '#[derive(Clone, Debug)]\npub enum ' + name + ' {}\n';
  }).join('\n');
