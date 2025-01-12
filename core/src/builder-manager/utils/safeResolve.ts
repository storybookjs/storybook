export const safeResolve = (path: string) => {
  try {
    return Promise.resolve(require.resolve(path));
  } catch (e) {
    return Promise.resolve(false as const);
  }
};
