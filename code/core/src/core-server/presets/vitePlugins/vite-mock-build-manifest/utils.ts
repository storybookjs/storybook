const DEFAULT_MODULE_DIRECTORIES = ['/node_modules/'];

export function isModuleDirectory(path: string) {
  return DEFAULT_MODULE_DIRECTORIES.some((dir: string) => path.includes(dir));
}
