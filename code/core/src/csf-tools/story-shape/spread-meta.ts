import { dirname, relative, resolve } from 'node:path';

import { type NodePath, types as t } from 'storybook/internal/babel';

import type { CsfFile } from '../CsfFile.ts';
import { importedName, isTypeSpecifier } from './imports.ts';
import type { ReferenceContext } from './resolve-members.ts';
import { metaObjectPath, pathForNode, unwrapExpression } from './utils.ts';

/** The meta of another story file that a story file's meta spreads, read in the file it is in. */
export interface SpreadMeta {
  /** The other file's meta object. */
  path: NodePath<t.ObjectExpression>;
  /** The other file, which the names in `path` resolve in. */
  ctx: ReferenceContext;
  /** The members the story file's meta writes over it. */
  own: t.ObjectExpression;
}

/**
 * The meta a story file's meta starts from by spreading the default export of another story file,
 * as `export default { ...meta, title: 'Button/Interactions' }` with `import meta from
 * './button.stories'` does. `undefined` for any other meta, or one that spreads anything else.
 */
export function resolveSpreadMeta(csf: CsfFile, ctx: ReferenceContext): SpreadMeta | undefined {
  const meta = metaObjectPath(csf)?.node;
  const [first, ...rest] = meta?.properties ?? [];
  if (!t.isSpreadElement(first) || rest.some((property) => t.isSpreadElement(property))) {
    return undefined;
  }
  const argument = unwrapExpression(first.argument);
  const binding = t.isIdentifier(argument) && ctx.program.scope.getBinding(argument.name);
  const specifier = binding && binding.kind === 'module' ? binding.path.node : undefined;
  const declaration = binding ? binding.path.parent : undefined;
  if (
    !t.isImportDeclaration(declaration) ||
    declaration.importKind === 'type' ||
    !(t.isImportDefaultSpecifier(specifier) || t.isImportSpecifier(specifier)) ||
    isTypeSpecifier(specifier)
  ) {
    return undefined;
  }
  const module = ctx.resolveModule?.(ctx.filePath, declaration.source.value);
  if (!module) {
    return undefined;
  }
  const exportName = t.isImportDefaultSpecifier(specifier)
    ? 'default'
    : importedName(specifier.imported);
  const object = exportedObject(module.program, exportName);
  const path = object && pathForNode(module.program, object);
  return path?.isObjectExpression()
    ? { path, ctx: { ...ctx, ...module }, own: t.objectExpression(rest) }
    : undefined;
}

/**
 * A relative specifier written in `fromFile`, as `toFile` would write it; any other specifier as it
 * is.
 */
export const rebaseSpecifier = (specifier: string, fromFile: string, toFile: string): string => {
  if (!specifier.startsWith('.')) {
    return specifier;
  }
  const rebased = relative(dirname(toFile), resolve(dirname(fromFile), specifier))
    .split('\\')
    .join('/');
  return rebased.startsWith('.') ? rebased : `./${rebased}`;
};

// The object literal a module exports under `exportName`, written out or as a `const`.
function exportedObject(
  program: NodePath<t.Program>,
  exportName: string
): t.ObjectExpression | undefined {
  const objectOf = (node: t.Node | null | undefined): t.ObjectExpression | undefined => {
    const value = node && unwrapExpression(node);
    if (t.isObjectExpression(value)) {
      return value;
    }
    const binding = t.isIdentifier(value) ? program.scope.getBinding(value.name) : undefined;
    return binding?.constant && t.isVariableDeclarator(binding.path.node)
      ? objectOf(binding.path.node.init)
      : undefined;
  };
  for (const statement of program.node.body) {
    if (t.isExportDefaultDeclaration(statement) && exportName === 'default') {
      return objectOf(statement.declaration);
    }
    if (t.isExportNamedDeclaration(statement) && t.isVariableDeclaration(statement.declaration)) {
      const declarator = statement.declaration.declarations.find((candidate) =>
        t.isIdentifier(candidate.id, { name: exportName })
      );
      if (declarator) {
        return objectOf(declarator.init);
      }
    }
  }
  return undefined;
}
