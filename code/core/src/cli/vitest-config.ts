import { type E, parseModule, unwrapExpression } from '../csf-tools/estree/ast.ts';

const MAX_RESOLVE_DEPTH = 10;

/**
 * Resolve an expression through TypeScript wrappers (`as`, `satisfies`, `!`, `<T>`) and references
 * to top-level `const`/`let`/`var` declarations (exported or not).
 *
 * Returns `null` for a missing expression or a reference chain deeper than 10.
 */
export const resolveExpression = (
  expr: E.Node | null | undefined,
  program: E.Program,
  depth = 0
): E.Node | null => {
  if (!expr || depth > MAX_RESOLVE_DEPTH) {
    return null;
  }
  const unwrapped = unwrapExpression(expr);
  if (unwrapped.type !== 'Identifier') {
    return unwrapped;
  }
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    const declarator = declaration.declarations.find(
      (d) => d.id.type === 'Identifier' && d.id.name === unwrapped.name
    );
    if (declarator) {
      return declarator.init ? resolveExpression(declarator.init, program, depth + 1) : unwrapped;
    }
  }
  return unwrapped;
};

const isImportedDefineConfigLike = (localName: string, program: E.Program): boolean =>
  program.body.some(
    (node) =>
      node.type === 'ImportDeclaration' &&
      (node.source.value === 'vitest/config' || node.source.value === 'vite') &&
      node.specifiers.some(
        (specifier) =>
          specifier.type === 'ImportSpecifier' &&
          specifier.local.name === localName &&
          specifier.imported.type === 'Identifier' &&
          (specifier.imported.name === 'defineConfig' ||
            specifier.imported.name === 'defineProject')
      )
  );

const isDefineConfigLike = (node: E.CallExpression, program: E.Program): boolean =>
  node.callee.type === 'Identifier' &&
  (node.callee.name === 'defineConfig' ||
    node.callee.name === 'defineProject' ||
    isImportedDefineConfigLike(node.callee.name, program));

const isMergeConfigCall = (node: E.Node | null): node is E.CallExpression =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'Identifier' &&
  node.callee.name === 'mergeConfig';

/**
 * Resolve a `mergeConfig` argument to its config object: an object literal, a variable holding one,
 * or a call wrapping one (`defineConfig({ ... })`).
 */
export const getConfigObjectFromMergeArg = (
  arg: E.Node,
  program: E.Program
): E.ObjectExpression | null => {
  const resolved = resolveExpression(arg, program);
  if (resolved?.type === 'ObjectExpression') {
    return resolved;
  }
  if (resolved?.type === 'CallExpression' && resolved.arguments[0]?.type === 'ObjectExpression') {
    return resolved.arguments[0];
  }
  return null;
};

/**
 * Find the `mergeConfig(...)` call a default export evaluates to, directly or through
 * `defineConfig(mergeConfig(...))`, variable references and TypeScript wrappers.
 */
export const getEffectiveMergeConfigCall = (
  decl: E.Node,
  program: E.Program
): E.CallExpression | null => {
  const resolved = resolveExpression(decl, program);
  if (resolved?.type !== 'CallExpression') {
    return null;
  }
  if (isDefineConfigLike(resolved, program) && resolved.arguments.length > 0) {
    const inner = resolveExpression(resolved.arguments[0], program);
    if (isMergeConfigCall(inner)) {
      return inner;
    }
  }
  return isMergeConfigCall(resolved) ? resolved : null;
};

/**
 * Find the config object a default export evaluates to: `{ ... }`, `defineConfig({ ... })`,
 * `defineProject({ ... })`, or a `defineConfig` callback whose body is an object literal or a single
 * `return { ... }`. Variable references and TypeScript wrappers are followed.
 */
export const getTargetConfigObject = (
  program: E.Program,
  exportDefault: E.ExportDefaultDeclaration
): E.ObjectExpression | null => {
  const resolved = resolveExpression(exportDefault.declaration, program);
  if (resolved?.type === 'ObjectExpression') {
    return resolved;
  }
  if (resolved?.type !== 'CallExpression' || !isDefineConfigLike(resolved, program)) {
    return null;
  }
  const [arg] = resolved.arguments;
  if (arg?.type === 'ObjectExpression') {
    return arg;
  }
  if (arg?.type !== 'ArrowFunctionExpression' && arg?.type !== 'FunctionExpression') {
    return null;
  }
  if (arg.body?.type === 'ObjectExpression') {
    return arg.body;
  }
  // Only `{ return { ... } }`: anything with control flow may return other objects.
  if (arg.body?.type === 'BlockStatement' && arg.body.body.length === 1) {
    const [statement] = arg.body.body;
    if (statement.type === 'ReturnStatement') {
      const returned = resolveExpression(statement.argument, program);
      return returned?.type === 'ObjectExpression' ? returned : null;
    }
  }
  return null;
};

/** Find a module's `export default` declaration. */
export const findExportDefault = (program: E.Program) =>
  program.body.find(
    (node): node is E.ExportDefaultDeclaration => node.type === 'ExportDefaultDeclaration'
  );

/**
 * Whether addon-vitest's postinstall can merge its config template into this Vitest/Vite config:
 * the default export must resolve to a config object or a `mergeConfig(...)` call (see
 * {@link getTargetConfigObject} and {@link getEffectiveMergeConfigCall}).
 */
export const canUpdateVitestConfigFile = (fileContent: string): boolean => {
  let program: E.Program;
  try {
    ({ program } = parseModule(fileContent));
  } catch {
    return false;
  }
  const exportDefault = findExportDefault(program);
  return (
    !!exportDefault &&
    (getTargetConfigObject(program, exportDefault) !== null ||
      getEffectiveMergeConfigCall(exportDefault.declaration, program) !== null)
  );
};
