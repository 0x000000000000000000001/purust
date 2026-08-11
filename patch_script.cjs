const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

// 1. Fix ExprApp missing .call.clone().unwrap()
const appRegex = /return "\(" \+ fnCode \+ "\)\(" \+ joinWith\(\", \"\)\(argsCodeArray\) \+ "\)";/;
code = code.replace(appRegex, `
      let callStr = fnCode;
      for (let i = 0; i < argsCodeArray.length; i++) {
        if (i === 0) {
          callStr = "(" + callStr + ")(" + argsCodeArray[i] + ")";
        } else {
          callStr = "(" + callStr + ").call.clone().unwrap()(" + argsCodeArray[i] + ")";
        }
      }
      return callStr;
`);

// 2. Fix codegenBindingGroup missing .call.clone().unwrap()
const bgRegex = /const innerExpr2 = "\(" \+ innerExpr \+ "\)\(" \+ joinWith\(\", \"\)\(arrayMap\(\(v2\) => v2\._1\)\(paramPairs\)\) \+ "\)";/;
code = code.replace(bgRegex, `
        let innerExpr2 = "(" + innerExpr + ")";
        const paramsArgs = arrayMap((v2) => v2._1)(paramPairs);
        for (let i = 0; i < paramsArgs.length; i++) {
            innerExpr2 = "(" + innerExpr2 + ")" + (i === 0 ? "" : ".call.clone().unwrap()") + "(" + paramsArgs[i] + ")";
        }
`);

// 3. Extract getCapturedLocals helper
code = code.replace(/var freeVariables = \(v\) => {/, `
const getCapturedLocals = (v) => {
    const freeVarsMap = freeVariables(v);
    const capturedKeys = [];
    const getKeys = (node) => {
        if (node && node.tag === "Node") {
            capturedKeys.push(node._3);
            getKeys(node._5);
            getKeys(node._6);
        }
    };
    getKeys(freeVarsMap);
    return capturedKeys.filter(name => !/^[A-Z]/.test(name));
};

var freeVariables = (v) => {
`);

// 4. Fix ExprAbs to wrap in Record_a and shadow captured variables
const absRegex = /return "unsafe_coerce\\(std::rc::Rc::new\\(move \\|" \+ joinWith\("\\, "\\)\\(arrayMap\\(\\(p\\) => \{\n\s*if \\(p === "_"\\) \{\n\s*return "" \+ p \+ ": UnknownType";\n\s*\}\n\s*return "mut " \+ p \+ ": UnknownType";\n\s*\}\)\\(paramsArr\\)\\) \+ "\\| -> UnknownType \{\\n" \+ joinWith\(""\\)\\(arrayMap\\(\\(p\\) => \{\n\s*if \\(p !== "_" && !member2\\(p\\)\\(bodyVars\\)\\) \{\n\s*return "    \/\/ DEBUG: bodyVars=" \+ show3\\(fromFoldableImpl\\(foldableSet\.foldr\, bodyVars\\)\\) \+ " p=" \+ p \+ "\\n    " \+ p \+ "\.drop_explicit\\(\\);\\n";\n\s*\}\n\s*return "";\n\s*\}\)\\(paramsArr\\)\\) \+ "    " \+ codegenExpr\\(currentMod\\)\\(allZeroArity\\)\\(allMacroBindings\\)\\(mbLoop\\)\\(bound\\)\\(Leaf\\)\\(v\._2\\) \+ "\\n\}\)\)";/;

code = code.replace(absRegex, `
    const capturedLocals = getCapturedLocals(v);
    const closureCode = "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, call: Some(std::rc::Rc::new(move |" + joinWith(", ")(arrayMap((p) => {
      if (p === "_") {
        return "" + p + ": UnknownType";
      }
      return "mut " + p + ": UnknownType";
    })(paramsArr)) + "| -> UnknownType {\\n" + 
    (capturedLocals.length > 0 ? capturedLocals.map(name => \`    let mut \${name} = \${name}.clone();\\n\`).join("") : "") +
    joinWith("")(arrayMap((p) => {
      if (p !== "_" && !member2(p)(bodyVars)) {
        return "    // DEBUG: bodyVars=" + show3(fromFoldableImpl(foldableSet.foldr, bodyVars)) + " p=" + p + "\\n    " + p + ".drop_explicit();\\n";
      }
      return "";
    })(paramsArr)) + "    " + codegenExpr(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(bound)(Leaf)(v._2) + "\\n})) })";
    return closureCode;
`);

// 5. Fix ExprApp (returning closure) to shadow captured variables
const appClosureRegex = /return "unsafe_coerce\\(std::rc::Rc::new\\(move \\|" \+ joinWith\("\\, "\\)\\(arrayMap\\(\\(v1\\) => "mut " \+ v1 \+ ": UnknownType"\\)\\(missingVars\\)\\) \+ "\\| \\(" \+ fnCode \+ "\\)\\(" \+ joinWith\("\\, "\\)\\(\\[\n\s*\.\.\.argsCodeArray,\n\s*\.\.\.missingVars\n\s*\\]\\) \+ "\\)\\)\\)";/;

code = code.replace(appClosureRegex, `
      const capturedLocals = getCapturedLocals(v);
      return "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, call: Some(std::rc::Rc::new(move |" + joinWith(", ")(arrayMap((v1) => "mut " + v1 + ": UnknownType")(missingVars)) + "| -> UnknownType {\\n" +
      (capturedLocals.length > 0 ? capturedLocals.map(name => \`    let mut \${name} = \${name}.clone();\\n\`).join("") : "") +
      "    (" + fnCode + ")(" + joinWith(", ")([
        ...argsCodeArray,
        ...missingVars
      ]) + ")\\n})) })";
`);

fs.writeFileSync('bin/purust.js', code);
