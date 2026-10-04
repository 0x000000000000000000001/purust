export const runtimeZero = () => 0;
export const makeHandle = () => ({ value: 42 });
export const checkHandle = handle => () => {
  if (handle.value !== 42) throw new Error('Primed foreign handle lost its payload');
};
export const checkZero = negative => value => () => {
  if (value !== 0 || Object.is(value, -0) !== negative) {
    throw new Error('Compiler host lost the IEEE zero sign');
  }
};
