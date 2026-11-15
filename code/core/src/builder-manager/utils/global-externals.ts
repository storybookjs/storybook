import type { Plugin } from 'rolldown';

interface GlobalModule {
  varName: string;
  namedExports: readonly string[];
}

export const GLOBAL_MODULE_PREFIX = '\0storybook-global:';

// Replaces the modules the manager already holds by the global variable each is kept in, for an
// `import` as well as a `require`.
export const globalExternals = (modules: Record<string, GlobalModule>): Plugin => ({
  name: 'storybook:manager-globals',
  resolveId(id) {
    return Object.hasOwn(modules, id) ? GLOBAL_MODULE_PREFIX + id : null;
  },
  load(id) {
    if (!id.startsWith(GLOBAL_MODULE_PREFIX)) {
      return null;
    }
    const { varName, namedExports } = modules[id.slice(GLOBAL_MODULE_PREFIX.length)];
    const names = [...new Set(namedExports)].join(', ');
    return `export default ${varName};\nconst { ${names} } = ${varName};\nexport { ${names} };`;
  },
});
