import type { Plugin } from 'rolldown';

interface GlobalModule {
  varName: string;
  namedExports: readonly string[];
}

export const GLOBAL_MODULE_PREFIX = '\0storybook-global:';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Replaces each module the manager already holds by a module that reads it from its global
// variable, so an `import` and a `require` of it both work.
export const globalExternals = (modules: Record<string, GlobalModule>): Plugin => ({
  name: 'storybook:manager-globals',
  resolveId: {
    filter: { id: new RegExp(`^(?:${Object.keys(modules).map(escapeRegExp).join('|')})$`) },
    handler: (id) => GLOBAL_MODULE_PREFIX + id,
  },
  load: {
    filter: { id: new RegExp(`^${GLOBAL_MODULE_PREFIX}`) },
    handler: (id) => {
      const { varName, namedExports } = modules[id.slice(GLOBAL_MODULE_PREFIX.length)];
      const names = [...new Set(namedExports)].join(', ');
      return `export default ${varName};\nconst { ${names} } = ${varName};\nexport { ${names} };`;
    },
  },
});
