export const moduleIsAvailable = (moduleName: string): boolean => {
  try {
    const resolved = import.meta.resolve(moduleName);
    return !!resolved;
  } catch (e) {
    return false;
  }
};
