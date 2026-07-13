import { type JSXIdentifier, type JSXOpeningElement, type Statement } from '@babel/types';
import { types as t, transformSync, type NodePath } from 'storybook/internal/babel';
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
const ROUTE_FACTORY_RE =
  /\b(createFileRoute|createRootRoute|createRootRouteWithContext|createRoute)\b/;

const ROUTE_FACTORIES = new Set([
  'createFileRoute',
  'createRootRoute',
  'createRootRouteWithContext',
  'createRoute',
]);

const ANY_PATTERN_RE =
  /\b(createServerFn|createMiddleware|createIsomorphicFn|createServerOnlyFn|createClientOnlyFn|createFileRoute|createRootRoute|createRootRouteWithContext|createRoute)\b/;

export function serverCodeEliminationPlugin(options: { excludeFiles?: string[] } = {}): Plugin {
  const excludeFiles = options.excludeFiles ?? [];

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
        if (excludeFiles.some((excluded) => id.includes(excluded))) {
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

// todo make storybook/internal/babel export PluginObj
function serverCodeElimination(
  state: TransformState
): NonNullable<NonNullable<Parameters<typeof transformSync>[1]>['plugins']>[number] {
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

            // createFileRoute('/path')({ ..., server: {...} }) →
            // createFileRoute('/path')({ ... })
            // createRootRoute({ server: {...} }) → createRootRoute({})
            // createRootRouteWithContext<...>()({ server: {...} }) → ({})
            // createRoute({ server: {...} }) → createRoute({})
            if (ROUTE_FACTORY_RE.test(state.code)) {
              const routeOptionsArg = getRouteFactoryOptionsArg(node, tanstackImports);
              if (routeOptionsArg && stripServerOption(routeOptionsArg)) {
                state.modified = true;
                // fall through — no `return`, the call may still match other rules
              }
            }

            // createServerOnlyFn(fn) → fn() no-op spy
            if (
              t.isIdentifier(node.callee) &&
              resolves(node.callee.name, 'createServerOnlyFn') &&
              SERVER_ONLY_FN_RE.test(state.code)
            ) {
              path.replaceWith(sbFnCall());
              state.modified = true;
              return;
            }

            // createClientOnlyFn(fn) → fn(originalImpl) spy wrapping original
            if (
              t.isIdentifier(node.callee) &&
              resolves(node.callee.name, 'createClientOnlyFn') &&
              CLIENT_ONLY_FN_RE.test(state.code)
            ) {
              const innerFn = node.arguments[0];
              if (innerFn && t.isExpression(innerFn)) {
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
                if (t.isIdentifier(handlerArg)) {
                  const binding = path.scope.getBinding(handlerArg.name);
                  if (binding && binding.referencePaths.length === 1) {
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
                if (t.isMemberExpression(path.node.callee)) {
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
                if (innerFn && t.isExpression(innerFn)) {
                  path.replaceWith(sbFnCallWithImpl(innerFn));
                  state.modified = true;
                }
                return;
              }

              if (methodName === 'server') {
                const parent = path.parent;
                if (!t.isMemberExpression(parent) || !t.isCallExpression(path.parentPath?.parent)) {
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
  return t.importDeclaration(
    [t.importSpecifier(t.identifier('__sb_fn'), t.identifier('fn'))],
    t.stringLiteral('storybook/test')
  );
}

/** Build `__sb_fn()` — no-op spy for server code */
function buildFnCall() {
  return t.callExpression(t.identifier('__sb_fn'), []);
}

/** Build `__sb_fn(impl)` — spy wrapping the original implementation for client code */
function buildFnCallWithImpl(impl: import('@babel/types').Expression) {
  return t.callExpression(t.identifier('__sb_fn'), [impl]);
}

/**
 * Collect import bindings from TanStack packages.
 * Returns a map from local name → original imported name.
 */
function collectTanstackImports(body: Statement[]) {
  const imports = new Map<string, string>();
  for (const node of body) {
    if (!t.isImportDeclaration(node)) {
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
      if (t.isImportSpecifier(spec)) {
        const importedName = t.isIdentifier(spec.imported)
          ? spec.imported.name
          : spec.imported.value;
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
  node: ReturnType<typeof t.callExpression>
): { rootCall: ReturnType<typeof t.callExpression>; rootName: string } | null {
  let current: ReturnType<typeof t.callExpression> = node;

  while (true) {
    const callee = current.callee;
    if (t.isIdentifier(callee)) {
      return { rootCall: current, rootName: callee.name };
    }
    if (t.isMemberExpression(callee) && t.isCallExpression(callee.object)) {
      current = callee.object;
      continue;
    }
    return null;
  }
}

/** Get the method name from `expr.method(...)` → `"method"` */
function getMethodName(node: ReturnType<typeof t.callExpression>): string | null {
  if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
    return node.callee.property.name;
  }
  return null;
}

/**
 * Extract the options object argument of a route factory call, if the call
 * matches one of the supported TanStack route factories:
 *
 * - `createRootRoute(opts)`
 * - `createRoute(opts)`
 * - `createFileRoute('/path')(opts)`
 * - `createRootRouteWithContext<...>()(opts)`
 *
 * Returns the `ObjectExpression` for `opts`, or `null` when the call doesn't
 * match or the argument isn't an inline object literal.
 */
function getRouteFactoryOptionsArg(
  node: ReturnType<typeof t.callExpression>,
  imports: Map<string, string>
): import('@babel/types').ObjectExpression | null {
  const factoryName = getRouteFactoryName(node, imports);
  if (!factoryName) {
    return null;
  }
  const optionsArg = node.arguments[0];
  return t.isObjectExpression(optionsArg) ? optionsArg : null;
}

function getRouteFactoryName(
  node: ReturnType<typeof t.callExpression>,
  imports: Map<string, string>
): string | null {
  // Direct call: createRoute(...) / createRootRoute(...)
  if (t.isIdentifier(node.callee)) {
    const resolved = imports.get(node.callee.name) ?? node.callee.name;
    return ROUTE_FACTORIES.has(resolved) ? resolved : null;
  }
  // Curried call: createFileRoute('/path')(...) /
  //               createRootRouteWithContext<...>()(...)
  if (t.isCallExpression(node.callee) && t.isIdentifier(node.callee.callee)) {
    const calleeName = node.callee.callee.name;
    const resolved = imports.get(calleeName) ?? calleeName;
    return ROUTE_FACTORIES.has(resolved) ? resolved : null;
  }
  return null;
}

/**
 * Drop the `server` property from a route options object literal. Used to
 * strip server-only handlers (e.g. `server: { handler: ... }`) so their
 * imports become unreferenced and are removed by the dead-import pass.
 *
 * Returns true when at least one property was removed.
 */
function stripServerOption(options: import('@babel/types').ObjectExpression): boolean {
  const initialLength = options.properties.length;
  options.properties = options.properties.filter((prop) => {
    if (!t.isObjectProperty(prop) || prop.computed) {
      return true;
    }
    const key = prop.key;
    const keyName = t.isIdentifier(key) ? key.name : undefined;
    return keyName !== 'server';
  });
  return options.properties.length !== initialLength;
}

function getJsxRootIdentifier(name: JSXOpeningElement['name']): JSXIdentifier | null {
  while (t.isJSXMemberExpression(name)) {
    name = name.object;
  }
  return t.isJSXIdentifier(name) ? name : null;
}

/**
 * Collect all non-binding identifier references in the program.
 * Excludes binding sites (declarations) and import specifiers.
 */
function collectReferencedIdentifiers(
  programPath: NodePath<import('@babel/types').Program>
): Set<string> {
  const referenced = new Set<string>();
  programPath.traverse({
    enter(path) {
      const { node } = path;
      if (!t.isIdentifier(node) || path.isBindingIdentifier()) {
        return;
      }
      if (path.findParent((p) => p.isImportDeclaration())) {
        return;
      }
      referenced.add(node.name);
    },
    JSXOpeningElement(path) {
      const root = getJsxRootIdentifier(path.node.name);
      if (root) {
        referenced.add(root.name);
      }
    },
  });
  return referenced;
}

/**
 * Remove top-level non-exported declarations whose bound names are never
 * referenced elsewhere. This handles hoisted helpers that become dead after
 * server code is eliminated (e.g. `function helper() { ... }` only called
 * inside a `.handler()` arg that was replaced with `__sb_fn()`).
 *
 * Returns true when at least one declaration was removed.
 */
function removeDeadTopLevelDeclarations(
  programPath: NodePath<import('@babel/types').Program>
): boolean {
  const referenced = collectReferencedIdentifiers(programPath);
  let removed = false;

  for (const stmtPath of programPath.get('body')) {
    if (stmtPath.isImportDeclaration() || stmtPath.isExportDeclaration()) {
      continue;
    }

    if (stmtPath.isFunctionDeclaration()) {
      const id = stmtPath.node.id;
      if (id && !referenced.has(id.name)) {
        stmtPath.remove();
        removed = true;
      }
      continue;
    }

    if (stmtPath.isVariableDeclaration()) {
      // Only remove when every declarator is dead: plain identifier binding,
      // unreferenced, and initializer absent or provably side-effect-free.
      const allDead = stmtPath.get('declarations').every((declPath) => {
        if (!t.isIdentifier(declPath.node.id)) return false;
        if (referenced.has(declPath.node.id.name)) return false;
        const initPath = declPath.get('init');
        return !declPath.node.init || initPath.isPure();
      });
      if (allDead) {
        stmtPath.remove();
        removed = true;
      }
    }
  }

  return removed;
}

/**
 * Remove import specifiers that are no longer referenced in the AST.
 * Drops entire import declarations when all specifiers are unreferenced.
 *
 * Returns true when at least one specifier was removed.
 */
function removeDeadImportSpecifiers(
  programPath: NodePath<import('@babel/types').Program>
): boolean {
  const referenced = collectReferencedIdentifiers(programPath);
  let removed = false;

  programPath.traverse({
    ImportDeclaration(path) {
      // Side-effect-only imports (`import './styles.css'`) have no specifiers
      // and must never be removed by this pass.
      if (path.node.specifiers.length === 0) {
        return;
      }

      const specifiers = path.node.specifiers.filter((spec) => referenced.has(spec.local.name));

      if (specifiers.length === 0) {
        path.remove();
        removed = true;
      } else if (specifiers.length !== path.node.specifiers.length) {
        path.node.specifiers = specifiers;
        removed = true;
      }
    },
  });

  return removed;
}

/**
 * Iteratively eliminate dead top-level declarations and dead imports until
 * the AST reaches a fixed point. The loop is needed because removing a dead
 * declaration (e.g. a hoisted helper) may expose new dead imports, and
 * removing a dead import may expose further dead declarations.
 */
function eliminateDeadImports(programPath: NodePath<import('@babel/types').Program>) {
  let changed = true;
  while (changed) {
    const d = removeDeadTopLevelDeclarations(programPath);
    const i = removeDeadImportSpecifiers(programPath);
    changed = d || i;
  }
}
