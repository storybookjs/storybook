export const isPrerelease = (version: string) => {
  return version.includes('-');
};
