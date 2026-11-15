import type { Plugin } from 'rolldown';

export interface GlobalModule {
  varName: string;
  namedExports: readonly string[];
}

const PREFIX = '\0storybook-global:';

/**
 * Replace the modules the manager already holds by the global variable each is kept in, for an
 * `import` as well as a `require`.
 */
export const globalExternals = (modules: Record<string, GlobalModule>): Plugin => ({
  name: 'storybook:manager-globals',
  resolveId(id) {
    return Object.hasOwn(modules, id) ? PREFIX + id : null;
  },
  load(id) {
    if (!id.startsWith(PREFIX)) {
      return null;
    }
    const { varName, namedExports } = modules[id.slice(PREFIX.length)];
    const names = [...new Set(namedExports)].join(', ');
    return `export default ${varName};\nconst { ${names} } = ${varName};\nexport { ${names} };`;
  },
});
