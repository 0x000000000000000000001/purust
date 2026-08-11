const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const targetRecordRegex = /"\}\\n\\n"\\n      \) backendMod\.dataDecls <>\\n      "\#\\[derive\\(Clone\\)\\]\\npub struct Record_a \\{\\n" <>\\n      "    pub a: i64,\\n" <>\\n      "    pub b: Option<UnknownType>,\\n" <>\\n      "    pub c: Option<UnknownType>,\\n" <>\\n      "    pub ccc: Option<UnknownType>,\\n" <>\\n      "    pub d: Option<UnknownType>,\\n" <>\\n      "    pub x: Option<UnknownType>,\\n" <>\\n      "    pub Applicative0: Option<UnknownType>,\\n" <>\\n      "    pub pure: Option<UnknownType>,\\n" <>\\n      "    pub show: Option<UnknownType>,\\n" <>\\n      "    pub discard: Option<UnknownType>,\\n" <>\\n      "    pub proof: Option<UnknownType>,\\n" <>\\n      "    pub call: Option<std::rc::Rc<dyn Fn\\(UnknownType\\) -> UnknownType>>\\n" <>\\n      "\\}\\n\\n" <>/;

code = code.replace(targetRecordRegex, '"}\\n\\n"\\n      ) backendMod.dataDecls <>');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
