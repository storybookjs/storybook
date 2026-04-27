import { transformSync, type NodePath, type PluginObj } from '@babel/core';
import {
  type Statement,
  isImportDeclaration,
  isIdentifier,
  isImportSpecifier,
  isMemberExpression,
  isCallExpression,
  isExpression,
  identifier,
  stringLiteral,
  callExpression,
  importDeclaration,
  importSpecifier,
} from '@babel/types';
import type { Plugin } from 'vite';

interface TransformState {
  code: string;
  modified: boolean;
  needsFnImport: boolean;
}

// Same strategy as TanStack's `detectKindsInCode`.
const SERVER_FN_RE = /\bcreateServerFn\b/;
const MIDDLEWARE_RE = /\bcreateMiddleware\b/;
const ISOMORPHIC_FN_RE = /\bcreateIsomorphicFn\b/;
const SERVER_ONLY_FN_RE = /\bcreateServerOnlyFn\b/;
const CLIENT_ONLY_FN_RE = /\bcreateClientOnlyFn\b/;

const ANY_PATTERN_RE =
  /\b(createServerFn|createMiddleware|createIsomorphicFn|createServerOnlyFn|createClientOnlyFn)\b/;

export function serverCodeEliminationPlugin(options: { excludeFiles?: string[] } = {}): Plugin {
  const excludeFiles = new Set(options.excludeFiles ?? []);

  return {
    name: 'storybook:tanstack-react:server-code-elimination',
    enforce: 'pre',

    transform: {
      // we can fully rely on transform.filter
      // and not worry about the handler since tanstack start users are Vite > 8 only
      filter: {
        id: {
          include: [/\.tsx?$/],
          exclude: [/node_modules/],
        },
        code: ANY_PATTERN_RE,
      },
      async handler(code, id) {
        // Only process JS/TS files
        if (!/\.[mc]?[jt]sx?$/.test(id)) {
          return null;
        }

        // Skip files explicitly excluded by the caller (e.g. our own export-mocks)
        if (excludeFiles.has(id)) {
          return null;
        }

        if (!ANY_PATTERN_RE.test(code)) {
          return null;
        }

        const state: TransformState = { code, modified: false, needsFnImport: false };

        const result = transformSync(code, {
          filename: id,
          sourceType: 'module',
          parserOpts: {
            plugins: ['typescript', 'jsx'],
          },
          plugins: [() => serverCodeElimination(state)],
          sourceMaps: true,
          configFile: false,
          babelrc: false,
        });

        if (!state.modified || !result?.code) {
          return null;
        }

        return {
          code: result.code,
          map: result.map,
        };
      },
    },
  };
}

function serverCodeElimination(state: TransformState): PluginObj {
  /** No-op spy for server-side code */
  function sbFnCall() {
    state.needsFnImport = true;
    return buildFnCall();
  }

  /** Spy wrapping the original implementation for client-side code */
  function sbFnCallWithImpl(impl: import('@babel/types').Expression) {
    state.needsFnImport = true;
    return buildFnCallWithImpl(impl);
  }

  return {
    visitor: {
      Program(programPath) {
        const tanstackImports = collectTanstackImports(programPath.node.body);

        const resolves = (name: string, factory: string) =>
          resolvesToFactory(tanstackImports, name, factory);

        programPath.traverse({
          CallExpression(path) {
            const node = path.node;

            // createServerOnlyFn(fn) → fn() no-op spy
            if (
              isIdentifier(node.callee) &&
              resolves(node.callee.name, 'createServerOnlyFn') &&
              SERVER_ONLY_FN_RE.test(state.code)
            ) {
              path.replaceWith(sbFnCall());
              state.modified = true;
              return;
            }

            // createClientOnlyFn(fn) → fn(originalImpl) spy wrapping original
            if (
              isIdentifier(node.callee) &&
              resolves(node.callee.name, 'createClientOnlyFn') &&
              CLIENT_ONLY_FN_RE.test(state.code)
            ) {
              const innerFn = node.arguments[0];
              if (innerFn && isExpression(innerFn)) {
                path.replaceWith(sbFnCallWithImpl(innerFn));
                state.modified = true;
              }
              return;
            }

            const methodName = getMethodName(node);
            if (!methodName) {
              return;
            }

            const root = findChainRoot(node);
            if (!root) {
              return;
            }

            // createServerFn()...handler(fn) → replace handler arg with fn() spy
            if (
              methodName === 'handler' &&
              resolves(root.rootName, 'createServerFn') &&
              SERVER_FN_RE.test(state.code)
            ) {
              const handlerArg = node.arguments[0];
              if (handlerArg) {
                if (isIdentifier(handlerArg)) {
                  const binding = path.scope.getBinding(handlerArg.name);
                  if (binding) {
                    binding.path.remove();
                  }
                }
                node.arguments[0] = sbFnCall();
              }
              state.modified = true;
              return;
            }

            // createMiddleware()...server(fn) / .inputValidator(fn) → strip call
            if (resolves(root.rootName, 'createMiddleware') && MIDDLEWARE_RE.test(state.code)) {
              if (methodName === 'server' || methodName === 'inputValidator') {
                if (isMemberExpression(path.node.callee)) {
                  path.replaceWith(path.node.callee.object);
                  state.modified = true;
                }
              }
              return;
            }

            // createIsomorphicFn()...client(fn) → fn(originalImpl) spy wrapping original
            // createIsomorphicFn()...server(fn) (no .client) → fn() no-op spy
            if (
              resolves(root.rootName, 'createIsomorphicFn') &&
              ISOMORPHIC_FN_RE.test(state.code)
            ) {
              if (methodName === 'client') {
                const innerFn = node.arguments[0];
                if (innerFn && isExpression(innerFn)) {
                  path.replaceWith(sbFnCallWithImpl(innerFn));
                  state.modified = true;
                }
                return;
              }

              if (methodName === 'server') {
                const parent = path.parent;
                if (!isMemberExpression(parent) || !isCallExpression(path.parentPath?.parent)) {
                  path.replaceWith(sbFnCall());
                  state.modified = true;
                }
              }
              return;
            }
          },
        });

        if (!state.modified) {
          return;
        }

        if (state.needsFnImport) {
          programPath.node.body.unshift(buildFnImport());
        }

        eliminateDeadImports(programPath);
      },
    },
  };
}

/** Build `import { fn as __sb_fn } from 'storybook/test'` */
function buildFnImport() {
  return importDeclaration(
    [importSpecifier(identifier('__sb_fn'), identifier('fn'))],
    stringLiteral('storybook/test')
  );
}

/** Build `__sb_fn()` — no-op spy for server code */
function buildFnCall() {
  return callExpression(identifier('__sb_fn'), []);
}

/** Build `__sb_fn(impl)` — spy wrapping the original implementation for client code */
function buildFnCallWithImpl(impl: import('@babel/types').Expression) {
  return callExpression(identifier('__sb_fn'), [impl]);
}

/**
 * Collect import bindings from TanStack packages.
 * Returns a map from local name → original imported name.
 */
function collectTanstackImports(body: Statement[]) {
  const imports = new Map<string, string>();
  for (const node of body) {
    if (!isImportDeclaration(node)) {
      continue;
    }
    const src = node.source.value;
    if (
      !src.includes('@tanstack/') &&
      !src.includes('export-mocks') &&
      !src.includes('@storybook/tanstack-react')
    ) {
      continue;
    }
    for (const spec of node.specifiers) {
      if (isImportSpecifier(spec)) {
        const importedName = isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
        imports.set(spec.local.name, importedName);
      }
    }
  }
  return imports;
}

/**
 * Check if a local identifier resolves to a known TanStack factory,
 * either directly or via the import map.
 */
function resolvesToFactory(
  imports: Map<string, string>,
  name: string,
  factoryName: string
): boolean {
  return name === factoryName || imports.get(name) === factoryName;
}

/**
 * Walk up a method chain to find the root call expression.
 * e.g. `createServerFn().middleware(...).handler(fn)` → `createServerFn()`.
 */
function findChainRoot(
  node: ReturnType<typeof callExpression>
): { rootCall: ReturnType<typeof callExpression>; rootName: string } | null {
  let current: ReturnType<typeof callExpression> = node;

  while (true) {
    const callee = current.callee;
    if (isIdentifier(callee)) {
      return { rootCall: current, rootName: callee.name };
    }
    if (isMemberExpression(callee) && isCallExpression(callee.object)) {
      current = callee.object;
      continue;
    }
    return null;
  }
}

/** Get the method name from `expr.method(...)` → `"method"` */
function getMethodName(node: ReturnType<typeof callExpression>): string | null {
  if (isMemberExpression(node.callee) && isIdentifier(node.callee.property)) {
    return node.callee.property.name;
  }
  return null;
}

/**
 * Remove import specifiers that are no longer referenced in the AST.
 * Drops entire import declarations when all specifiers are unreferenced.
 */
function eliminateDeadImports(programPath: NodePath<import('@babel/types').Program>) {
  const referencedIdentifiers = new Set<string>();

  programPath.traverse({
    enter(path) {
      const { node } = path;
      if (isIdentifier(node) && !path.isBindingIdentifier()) {
        referencedIdentifiers.add(node.name);
      }
    },
  });

  programPath.traverse({
    ImportDeclaration(path) {
      const specifiers = path.node.specifiers.filter((spec) =>
        referencedIdentifiers.has(spec.local.name)
      );

      if (specifiers.length === 0) {
        path.remove();
      } else if (specifiers.length !== path.node.specifiers.length) {
        path.node.specifiers = specifiers;
      }
    },
  });
}
