import {
  type ESTree as E,
  type ESTreeNode as Node,
  type ScopeInfo,
  SourceEditor,
  walk,
} from 'storybook/internal/csf-tools';
import type { Plugin } from 'vite';

type Span = { start: number; end: number };

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

        const editor = new SourceEditor(code, id);
        if (!eliminateServerCode(editor)) {
          return null;
        }

        return {
          code: editor.toString(),
          map: editor.edits.generateMap({ source: id, includeContent: true, hires: true }),
        };
      },
    },
  };
}

const FN_IMPORT = `import { fn as __sb_fn } from "storybook/test";`;

/**
 * Rewrites server-only TanStack code in place and drops the declarations and imports that only it
 * used. Returns whether anything changed.
 */
function eliminateServerCode(editor: SourceEditor): boolean {
  const { code, program, edits } = editor;
  const tanstackImports = collectTanstackImports(program);
  const resolves = (name: string, factory: string) =>
    resolvesToFactory(tanstackImports, name, factory);

  // Source ranges whose original code is gone from the output.
  const removed: Span[] = [];
  const isGone = (node: Span) =>
    removed.some((span) => span.start <= node.start && node.end <= span.end);
  const replace = (span: Span, text: string) => {
    edits.overwrite(span.start, span.end, text);
    removed.push(span);
  };
  const remove = (span: Span) => {
    if (span.end > span.start) {
      edits.remove(span.start, span.end);
      removed.push(span);
    }
  };

  let modified = false;
  let needsFnImport = false;
  const fnCall = (span: Span) => {
    needsFnImport = true;
    replace(span, '__sb_fn()');
  };
  // `__sb_fn(impl)`: a spy wrapping the original implementation for client-side code.
  const fnCallWithImpl = (call: Span, impl: Span) => {
    needsFnImport = true;
    replace({ start: call.start, end: impl.start }, '__sb_fn(');
    replace({ start: impl.end, end: call.end }, ')');
  };

  walk(program, (node, parent) => {
    if (isGone(node)) {
      return false;
    }
    if (node.type !== 'CallExpression') {
      return;
    }

    // createFileRoute('/path')({ ..., server: {...} }) → createFileRoute('/path')({ ... })
    // createRootRoute({ server: {...} }) → createRootRoute({})
    // createRootRouteWithContext<...>()({ server: {...} }) → ({})
    // createRoute({ server: {...} }) → createRoute({})
    if (ROUTE_FACTORY_RE.test(code)) {
      const routeOptionsArg = getRouteFactoryOptionsArg(node, tanstackImports);
      if (routeOptionsArg) {
        const serverOptions = routeOptionsArg.properties.filter(isServerOption);
        serverOptions.forEach((option) =>
          remove(listItemRange(routeOptionsArg.properties, option))
        );
        modified ||= serverOptions.length > 0;
        // fall through — the call may still match other rules
      }
    }

    // createServerOnlyFn(fn) → fn() no-op spy
    if (
      node.callee.type === 'Identifier' &&
      resolves(node.callee.name, 'createServerOnlyFn') &&
      SERVER_ONLY_FN_RE.test(code)
    ) {
      fnCall(node);
      modified = true;
      return false;
    }

    // createClientOnlyFn(fn) → fn(originalImpl) spy wrapping original
    if (
      node.callee.type === 'Identifier' &&
      resolves(node.callee.name, 'createClientOnlyFn') &&
      CLIENT_ONLY_FN_RE.test(code)
    ) {
      const innerFn = node.arguments[0];
      if (innerFn && innerFn.type !== 'SpreadElement') {
        fnCallWithImpl(node, innerFn);
        modified = true;
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
      SERVER_FN_RE.test(code)
    ) {
      const handlerArg = node.arguments[0];
      if (handlerArg) {
        if (handlerArg.type === 'Identifier') {
          removeSingleUseDeclaration(editor, editor.scopes.bindingOf(handlerArg), remove);
        }
        fnCall(handlerArg);
      }
      modified = true;
      return;
    }

    // createMiddleware()...server(fn) / .inputValidator(fn) → strip call
    if (resolves(root.rootName, 'createMiddleware') && MIDDLEWARE_RE.test(code)) {
      if (
        (methodName === 'server' || methodName === 'inputValidator') &&
        node.callee.type === 'MemberExpression'
      ) {
        remove({ start: node.callee.object.end, end: node.end });
        modified = true;
      }
      return;
    }

    // createIsomorphicFn()...client(fn) → fn(originalImpl) spy wrapping original
    // createIsomorphicFn()...server(fn) (no .client) → fn() no-op spy
    if (resolves(root.rootName, 'createIsomorphicFn') && ISOMORPHIC_FN_RE.test(code)) {
      if (methodName === 'client') {
        const innerFn = node.arguments[0];
        if (innerFn && innerFn.type !== 'SpreadElement') {
          fnCallWithImpl(node, innerFn);
          modified = true;
        }
        return;
      }

      if (methodName === 'server') {
        const grandparent = parent && editor.parentOf(parent);
        if (parent?.type !== 'MemberExpression' || grandparent?.type !== 'CallExpression') {
          fnCall(node);
          modified = true;
          return false;
        }
      }
    }
  });

  if (!modified) {
    return false;
  }

  if (needsFnImport) {
    const directives = program.body.filter(
      (statement) => statement.type === 'ExpressionStatement' && statement.directive
    );
    const at = directives.at(-1)?.end ?? (code.startsWith('#!') ? code.indexOf('\n') + 1 : 0);
    edits.appendLeft(at, `${at > 0 ? '\n' : ''}${FN_IMPORT}\n`);
  }

  eliminateDeadCode(editor, isGone, remove);
  return true;
}

// The range to remove for one item of a comma-separated list, including one adjacent comma.
function listItemRange(items: readonly Span[], item: Span): Span {
  const index = items.indexOf(item);
  const next = items[index + 1];
  const previous = items[index - 1];
  if (next) {
    return { start: item.start, end: next.start };
  }
  return previous ? { start: previous.end, end: item.end } : item;
}

// Removes the declaration of a handler identifier that is used nowhere else.
function removeSingleUseDeclaration(
  editor: SourceEditor,
  binding: ReturnType<ScopeInfo['bindingOf']>,
  remove: (span: Span) => void
) {
  if (!binding || binding.references.length !== 1) {
    return;
  }
  if (binding.kind === 'function' || binding.kind === 'class') {
    remove(binding.node);
    return;
  }
  const declaration = binding.declaration as E.VariableDeclaration | undefined;
  if (
    !['var', 'let', 'const'].includes(binding.kind) ||
    binding.node.type !== 'VariableDeclarator' ||
    !declaration
  ) {
    return;
  }
  if (declaration.declarations.length === 1) {
    if (editor.parentOf(declaration)?.type !== 'ExportNamedDeclaration') {
      remove(declaration);
    }
    return;
  }
  remove(listItemRange(declaration.declarations, binding.node));
}

/**
 * Collect import bindings from TanStack packages.
 * Returns a map from local name → original imported name.
 */
function collectTanstackImports(program: E.Program) {
  const imports = new Map<string, string>();
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
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
      if (spec.type === 'ImportSpecifier') {
        const importedName =
          spec.imported.type === 'Identifier' ? spec.imported.name : String(spec.imported.value);
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
  node: E.CallExpression
): { rootCall: E.CallExpression; rootName: string } | null {
  let current = node;

  while (true) {
    const callee = current.callee;
    if (callee.type === 'Identifier') {
      return { rootCall: current, rootName: callee.name };
    }
    if (callee.type === 'MemberExpression' && callee.object.type === 'CallExpression') {
      current = callee.object;
      continue;
    }
    return null;
  }
}

/** Get the method name from `expr.method(...)` → `"method"` */
function getMethodName(node: E.CallExpression): string | null {
  if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
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
  node: E.CallExpression,
  imports: Map<string, string>
): E.ObjectExpression | null {
  const factoryName = getRouteFactoryName(node, imports);
  if (!factoryName) {
    return null;
  }
  const optionsArg = node.arguments[0];
  return optionsArg?.type === 'ObjectExpression' ? optionsArg : null;
}

function getRouteFactoryName(node: E.CallExpression, imports: Map<string, string>): string | null {
  // Direct call: createRoute(...) / createRootRoute(...)
  if (node.callee.type === 'Identifier') {
    const resolved = imports.get(node.callee.name) ?? node.callee.name;
    return ROUTE_FACTORIES.has(resolved) ? resolved : null;
  }
  // Curried call: createFileRoute('/path')(...) /
  //               createRootRouteWithContext<...>()(...)
  if (node.callee.type === 'CallExpression' && node.callee.callee.type === 'Identifier') {
    const calleeName = node.callee.callee.name;
    const resolved = imports.get(calleeName) ?? calleeName;
    return ROUTE_FACTORIES.has(resolved) ? resolved : null;
  }
  return null;
}

/**
 * A non-computed `server` property of a route options object literal. Stripping it drops
 * server-only handlers (e.g. `server: { handler: ... }`) so their imports become unreferenced and
 * are removed by the dead-code pass.
 */
function isServerOption(prop: E.ObjectExpression['properties'][number]): boolean {
  return (
    prop.type === 'Property' &&
    !prop.method &&
    prop.kind === 'init' &&
    !prop.computed &&
    prop.key.type === 'Identifier' &&
    prop.key.name === 'server'
  );
}

// Babel's `scope.isPure` for an initializer evaluated in the program scope.
function isPure(node: Node | null, scopes: ScopeInfo): boolean {
  if (!node) {
    return true;
  }
  switch (node.type) {
    case 'Identifier':
      return scopes.program.bindings.has(node.name);
    case 'Literal':
    case 'ThisExpression':
    case 'MetaProperty':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return true;
    case 'ClassExpression':
      return (
        (node.decorators?.length ?? 0) === 0 &&
        isPure(node.superClass, scopes) &&
        node.body.body.every((member) => isPure(member, scopes))
      );
    case 'MethodDefinition':
      return (!node.computed || isPure(node.key, scopes)) && (node.decorators?.length ?? 0) === 0;
    case 'PropertyDefinition':
      return (
        (!node.computed || isPure(node.key, scopes)) &&
        (node.decorators?.length ?? 0) === 0 &&
        (!node.static || isPure(node.value, scopes))
      );
    case 'Property':
      return (
        (!node.computed || isPure(node.key, scopes)) && (node.method || isPure(node.value, scopes))
      );
    case 'BinaryExpression':
    case 'LogicalExpression':
      return isPure(node.left, scopes) && isPure(node.right, scopes);
    case 'ArrayExpression':
      return node.elements.every((element) => isPure(element, scopes));
    case 'ObjectExpression':
      return node.properties.every((property) => isPure(property, scopes));
    case 'UnaryExpression':
      return isPure(node.argument, scopes);
    case 'TemplateLiteral':
      return node.expressions.every((expression) => isPure(expression, scopes));
    default:
      return false;
  }
}

/**
 * Iteratively remove top-level non-exported declarations and import specifiers that nothing left
 * in the output references, until a fixed point: removing a dead declaration (e.g. a hoisted
 * helper only called from a replaced `.handler()` arg) may expose dead imports and vice versa.
 */
function eliminateDeadCode(
  editor: SourceEditor,
  isGone: (node: Span) => boolean,
  remove: (span: Span) => void
) {
  const { program, scopes, edits } = editor;
  const isLive = (identifier: E.BindingIdentifier) =>
    !!scopes.bindingOf(identifier)?.references.some((reference) => !isGone(reference));
  const deadSpecifiers = new Set<Node>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of program.body) {
      if (isGone(statement)) {
        continue;
      }
      const dead =
        statement.type === 'FunctionDeclaration'
          ? !!statement.id && !isLive(statement.id)
          : statement.type === 'VariableDeclaration' &&
            statement.declarations.every(
              (declarator) =>
                declarator.id.type === 'Identifier' &&
                !isLive(declarator.id) &&
                isPure(declarator.init, scopes)
            );
      if (dead) {
        remove(statement);
        changed = true;
      }
    }

    for (const statement of program.body) {
      // Side-effect-only imports (`import './styles.css'`) have no specifiers and are always kept.
      if (statement.type !== 'ImportDeclaration' || isGone(statement)) {
        continue;
      }
      const specifiers = statement.specifiers.filter((spec) => !deadSpecifiers.has(spec));
      const live = specifiers.filter((spec) => isLive(spec.local));
      if (specifiers.length === 0 || live.length === specifiers.length) {
        continue;
      }
      specifiers.filter((spec) => !live.includes(spec)).forEach((spec) => deadSpecifiers.add(spec));
      changed = true;
      if (live.length === 0) {
        remove(statement);
        continue;
      }
      const named = live.filter((spec) => spec.type === 'ImportSpecifier');
      const clause = [
        ...live
          .filter((spec) => spec.type !== 'ImportSpecifier')
          .map((spec) => editor.source(spec)),
        ...(named.length > 0 ? [`{ ${named.map((spec) => editor.source(spec)).join(', ')} }`] : []),
      ].join(', ');
      edits.overwrite(
        statement.start,
        statement.source.start,
        `import ${statement.importKind === 'type' ? 'type ' : ''}${clause} from `
      );
    }
  }
}
