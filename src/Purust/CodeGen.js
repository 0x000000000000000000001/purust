export const sanitizeIdentImpl = fallback => value => fallback(value);

export const codegenExprTypeWithValueEnumsImpl =
  fallback => enums => currentMod => isRet => ty => fallback(enums)(currentMod)(isRet)(ty);
export const boxUnboxImpl = reference => renames => enums => fields => currentMod => expected => actual => code =>
  reference(renames)(enums)(fields)(currentMod)(expected)(actual)(code);
export const fieldBaseImpl = reference => renames => field => reference(renames)(field);
export const recordFieldIdentImpl = reference => renames => field => reference(renames)(field);
export const recordStructNameImpl = reference => renames => fields => reference(renames)(fields);
