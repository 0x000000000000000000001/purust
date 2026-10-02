export const memberLayoutImpl = fallback => enums => moduleName => typeName =>
  fallback(enums)(moduleName)(typeName);
