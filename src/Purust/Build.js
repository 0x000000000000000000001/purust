export const optimizerConcurrency = () => {
  const value = process.env.PURUST_PBO_JOBS ?? '';
  const jobs = /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isInteger(jobs) && jobs >= 1 && jobs <= 64 ? jobs : 1;
};

export const codegenConcurrency = () => {
  const value = process.env.PURUST_CODEGEN_JOBS ?? '';
  const jobs = /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isInteger(jobs) && jobs >= 1 && jobs <= 64 ? jobs : 1;
};
