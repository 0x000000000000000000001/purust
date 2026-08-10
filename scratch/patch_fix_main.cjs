const fs = require('fs');
let code = fs.readFileSync('fix_main_regex.cjs', 'utf8');

// Fix the syntax error
code = code.replace(/\/pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;\\n[\s\S]*?pub type Effect_Effect = UnknownType;/,
  '/pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;/g, \\'pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;\\\\n\\\\\\npub type Control_Monad_ST_Internal_ST = UnknownType;\\\\npub type Data_Array_ST_STArray = UnknownType;\\\\npub type Data_Unit_Unit = UnknownType;\\\\npub type Data_Lazy_Lazy = UnknownType;\\\\npub type Effect_Effect = UnknownType;\\'');

fs.writeFileSync('fix_main_regex.cjs', code);
