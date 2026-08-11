const fs = require('fs');

let code = fs.readFileSync('bin/purust.js', 'utf8');

// Find the ExprApp block
const match = code.match(/  if \(v\.tag === "App"\) \{[\s\S]*?  if \(v\.tag === "UncurriedEffectApp"\) \{/);
if (!match) {
    console.error("Could not find ExprApp block");
    process.exit(1);
}

const oldBlock = match[0];
const newBlock = `  if (v.tag === "App") {
    const numProvided = v._2.length;
    const fnTy = inferTypeExpr(currentMod)(Leaf)(bound)(v._1);
    const fnArity = fnTy.tag === "Func" ? fnTy._1.length : 0;
    const argsFree = arrayMap(freeVariables)(v._2);
    const argsCodeArray = mapWithIndexArray((i) => (arg) => codegenExpr(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      foldlArray(union)(Leaf)((() => {
        const $0 = i + 1 | 0;
        if ($0 < 1) {
          return argsFree;
        }
        return sliceImpl2($0, argsFree.length, argsFree);
      })())
    ))(arg))(v._2);
    const argsCode = joinWith(", ")(argsCodeArray);
    const fnCode = codegenExpr(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      foldlArray(union)(Leaf)(argsFree)
    ))(v._1);
    
    const isTopLevelFn = (() => {
      let curr = v._1;
      while (curr.tag === "Typed") {
        curr = curr._2;
      }
      if (curr.tag === "Var") {
        const rawIdentName = sanitizeIdent(replaceAll(".")("_")(curr._2));
        const identName = rawIdentName === "main" ? "main" : (curr._1.tag === "Just" ? replaceAll(".")("_")(curr._1._1) : currentMod) + "_" + rawIdentName;
        return lookup5(identName)(aritiesMap).tag === "Just";
      }
      return false;
    })();

    if (isTopLevelFn) {
      if (fnArity > numProvided) {
        const missingVars = mapWithIndexArray((i) => (v1) => "c_" + showIntImpl(i))(replicateImpl(fnArity - numProvided | 0, void 0));
        const capturedLocals = getCapturedLocals(v);
        const allArgsCode = [...argsCodeArray, ...missingVars].join(", ");
        return "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, proof: None, call: Some(std::rc::Rc::new(move |" + joinWith(", ")(arrayMap((v1) => "mut " + v1 + ": UnknownType")(missingVars)) + "| -> UnknownType {\\n" +
        (capturedLocals.length > 0 ? capturedLocals.map(name => \`    let mut \${name} = \${name}.clone();\\n\`).join("") : "") +
        "    (" + fnCode + ")(" + allArgsCode + ")\\n})) })";
      }
      return "(" + fnCode + ")(" + argsCode + ")";
    } else {
      let callStr = fnCode;
      for (let i = 0; i < argsCodeArray.length; i++) {
        callStr = "(" + callStr + ").call.clone().unwrap()(" + argsCodeArray[i] + ")";
      }
      return callStr;
    }
  }
  if (v.tag === "UncurriedEffectApp") {`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('bin/purust.js', code);
console.log("ExprApp replaced successfully");
