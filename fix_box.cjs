const fs = require('fs');
let code = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');

function wrapArgWithBox(code, enumVariant, argIndex) {
    let searchStr = enumVariant + "(";
    let idx = 0;
    while ((idx = code.indexOf(searchStr, idx)) !== -1) {
        let beforeMatch = code.substring(0, idx);
        // If it's a pattern match (e.g. `match v { Enum::Variant(` or `| Enum::Variant(`), skip!
        // We can check if it's inside a match arm by looking backwards for `match ` without a closing `}`?
        // Actually, just look at the characters immediately preceding it.
        // Pattern matches usually look like ` { Enum::Variant(` or ` Enum::Variant(` inside a match block.
        // Wait! In purust generated code, pattern matches ALWAYS have `..` inside the parens!
        let startParen = idx + searchStr.length;
        let pCount = 1;
        let endParen = startParen;
        while (pCount > 0 && endParen < code.length) {
            if (code[endParen] === '(') pCount++;
            if (code[endParen] === ')') pCount--;
            endParen++;
        }
        let inside = code.substring(startParen, endParen - 1);
        if (inside.includes('..')) {
            // It's a pattern match, don't wrap!
            // Wait, we DO need to update the variant name or something? No, in pattern matches Box is matched transparently by `box` or we don't need it.
            // Actually, in Rust `Cons(a, b)` where `b` is `Box<T>`, `b` will just be of type `Box<T>`. We just leave it alone.
            idx = endParen;
            continue;
        }

        // It's a construction! We need to parse arguments by comma, respecting nested parens/braces.
        let args = [];
        let currentArgStart = startParen;
        let depth = 0;
        for (let i = startParen; i < endParen - 1; i++) {
            if (code[i] === '(' || code[i] === '{' || code[i] === '[') depth++;
            if (code[i] === ')' || code[i] === '}' || code[i] === ']') depth--;
            if (code[i] === ',' && depth === 0) {
                args.push(code.substring(currentArgStart, i));
                currentArgStart = i + 1;
            }
        }
        args.push(code.substring(currentArgStart, endParen - 1));

        if (argIndex < args.length) {
            args[argIndex] = ' Box::new(' + args[argIndex].trim() + ')';
        }

        let replaced = searchStr + args.join(',') + ')';
        code = code.substring(0, idx) + replaced + code.substring(endParen);
        idx = idx + replaced.length;
    }
    return code;
}

code = wrapArgWithBox(code, 'Control_Monad_Gen_LL::Cons', 1);
code = wrapArgWithBox(code, 'Data_Foldable_FreeMonoidTree::Append', 0);
code = wrapArgWithBox(code, 'Data_Foldable_FreeMonoidTree::Append', 1); // wait, this will overwrite the first one if we call it sequentially? No, it's fine if we do it in one go.
fs.writeFileSync('tests/runner/output-test/app/src/main.rs', code);
