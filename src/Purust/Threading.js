// Apply ownership changes to Rust code, never to literal or comment contents.
// Lifetimes are code; character literals, raw strings and nested comments are not.
function mapCode(source, transform) {
  let result = "", start = 0, i = 0;
  const protect = end => {
    result += transform(source.slice(start, i)) + source.slice(i, end);
    i = start = end;
  };
  while (i < source.length) {
    if (source.startsWith("//", i)) {
      const end = source.indexOf("\n", i + 2);
      protect(end < 0 ? source.length : end);
    } else if (source.startsWith("/*", i)) {
      let end = i + 2, depth = 1;
      while (end < source.length && depth) {
        if (source.startsWith("/*", end)) { depth++; end += 2; }
        else if (source.startsWith("*/", end)) { depth--; end += 2; }
        else end++;
      }
      protect(end);
    } else {
      const raw = /^(?:br|cr|r)(#*)"/.exec(source.slice(i));
      if (raw && (i === 0 || !/[\w]/.test(source[i - 1]))) {
        const close = '"' + raw[1];
        const end = source.indexOf(close, i + raw[0].length);
        protect(end < 0 ? source.length : end + close.length);
      } else if (source[i] === '"') {
        let end = i + 1;
        while (end < source.length) {
          if (source[end] === "\\") end += 2;
          else if (source[end++] === '"') break;
        }
        protect(end);
      } else if (source[i] === "'") {
        const char = /^'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|[^\r\n])|[^'\\\r\n])'/u.exec(source.slice(i));
        if (char) protect(i + char[0].length);
        else i++;
      } else i++;
    }
  }
  return result + transform(source.slice(start));
}

function ownership(code) {
  return code.replaceAll("use std::rc::Rc;", "use std::sync::Arc as Rc;")
    .replaceAll("std::rc::Rc", "std::sync::Arc")
    .replace(/(?<!\bSync) \+ 'static/g, " + Send + Sync + 'static");
}

export const threadedRust = source => mapCode(source, ownership);
export const threadedPrelude = source => mapCode(source, code => ownership(code)
  .replaceAll(") -> R>),", ") -> R + Send + Sync>),")
  .replaceAll("dyn std::any::Any>", "dyn std::any::Any + Send + Sync>"));
