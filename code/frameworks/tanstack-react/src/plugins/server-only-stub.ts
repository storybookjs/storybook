import { babelParse as parse, types as t } from 'storybook/internal/babel';

import type { Plugin } from 'vite';

const SERVER_FILE_RE = /\.server\.(?:[mc]?[jt]sx?)$/;

interface ServerOnlyStubOptions {
  /** Additional regex patterns that should also be stubbed. */
  extraPatterns?: RegExp[];
}

/**
 * Replaces TanStack Start `*.server.{ts,js,tsx,jsx,mts,mjs,cts,cjs}` modules
 * (and any extra patterns) with no-op stubs in the browser bundle.
 */
export function serverOnlyStubPlugin(options: ServerOnlyStubOptions = {}): Plugin {
  const patterns = [SERVER_FILE_RE, ...(options.extraPatterns ?? [])];

  return {
    name: 'storybook:tanstack-react:server-only-stub',
    enforce: 'pre',
    transform: {
      filter: {
        id: {
          // The `id` filter is matched against the full resolved id, so the
          // pattern matches both `src/utils/foo.server.ts` and any other
          // `.server.*` file. We additionally re-check inside the handler in
          // case Vite ever changes how filters are applied.
          include: patterns,
          exclude: [/node_modules/],
        },
      },
      handler(code, id) {
        if (!patterns.some((re) => re.test(id))) {
          return null;
        }

        const exports = collectExports(code, id);
        return {
          code: buildStubCode(exports, id),
          map: { mappings: '' },
        };
      },
    },
  };
}

interface ExportInfo {
  named: Set<string>;
  hasDefault: boolean;
}

function collectExports(code: string, id: string): ExportInfo {
  const named = new Set<string>();
  let hasDefault = false;

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code);
  } catch {
    return { named, hasDefault };
  }

  for (const node of ast.program.body) {
    if (t.isExportDefaultDeclaration(node)) {
      hasDefault = true;
      continue;
    }
    if (t.isExportAllDeclaration(node)) {
      // `export * from '...'` — we can't enumerate; ignore to be safe.
      // Consumers of unknown re-exports will get `undefined`, which is
      // acceptable for server-only modules.
      continue;
    }
    if (t.isExportNamedDeclaration(node)) {
      const decl = node.declaration;
      if (decl) {
        if (t.isVariableDeclaration(decl)) {
          for (const declarator of decl.declarations) {
            if (t.isIdentifier(declarator.id)) {
              named.add(declarator.id.name);
            }
          }
        } else if ((t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) && decl.id?.name) {
          named.add(decl.id.name);
        }
      }
      for (const spec of node.specifiers) {
        if (t.isExportSpecifier(spec)) {
          const exportedName = t.isIdentifier(spec.exported)
            ? spec.exported.name
            : spec.exported.value;
          if (exportedName !== 'default') {
            named.add(exportedName);
          } else {
            hasDefault = true;
          }
        }
      }
    }
  }

  return { named, hasDefault };
}

function buildStubCode(exports: ExportInfo, id: string): string {
  const label = JSON.stringify(id);
  const namedExports = [...exports.named]
    .map((name) => `export const ${name} = __sb_serverOnly(${JSON.stringify(name)});`)
    .join('\n');
  const defaultExport = exports.hasDefault ? `export default __sb_serverOnly('default');` : '';

  return `import { fn as __sb_fn } from 'storybook/test';
function __sb_serverOnly(name) {
  return __sb_fn(() => {
    throw new Error(
      \`[storybook] Tried to call server-only export "\${name}" from \${${label}} in the browser.\`
    );
  }).mockName(name);
}
${namedExports}
${defaultExport}`.trim();
}
