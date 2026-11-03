import { dirname, relative, resolve } from 'pathe';

import type { CsfFile } from '../CsfFile.ts';
import { type E, type Node, unwrapExpression } from '../estree/ast.ts';
import type { SourceEditor } from '../estree/editor.ts';
import { importedName, isTypeSpecifier } from './imports.ts';
import type { ReferenceContext } from './resolve-members.ts';
import { metaObject } from './utils.ts';

/** The meta of another story file that a story file's meta spreads, read in the file it is in. */
export interface SpreadMeta {
  /** The other file's meta object. */
  object: E.ObjectExpression;
  /** The other file, which the names in `object` resolve in. */
  ctx: ReferenceContext;
  /** The story file's meta with only the members it writes over the spread one. */
  own: E.ObjectExpression;
}

/**
 * The meta a story file's meta starts from by spreading the default export of another story file,
 * as `export default { ...meta, title: 'Button/Interactions' }` with `import meta from
 * './button.stories'` does. `undefined` for any other meta, or one that spreads anything else.
 */
export function resolveSpreadMeta(csf: CsfFile, ctx: ReferenceContext): SpreadMeta | undefined {
  const meta = metaObject(csf);
  const [first, ...rest] = meta?.properties ?? [];
  if (
    first?.type !== 'SpreadElement' ||
    rest.some((property) => property.type === 'SpreadElement')
  ) {
    return undefined;
  }
  const argument = unwrapExpression(first.argument);
  const binding =
    argument.type === 'Identifier'
      ? ctx.editor.scopes.program.bindings.get(argument.name)
      : undefined;
  const specifier = binding?.kind === 'import' ? binding.node : undefined;
  const declaration = binding?.declaration;
  if (
    declaration?.type !== 'ImportDeclaration' ||
    declaration.importKind === 'type' ||
    !(specifier?.type === 'ImportDefaultSpecifier' || specifier?.type === 'ImportSpecifier') ||
    isTypeSpecifier(specifier)
  ) {
    return undefined;
  }
  const module = ctx.resolveModule?.(ctx.filePath, declaration.source.value);
  if (!module) {
    return undefined;
  }
  const exportName =
    specifier.type === 'ImportDefaultSpecifier' ? 'default' : importedName(specifier.imported);
  const object = exportedObject(module.editor, exportName);
  return object
    ? { object, ctx: { ...ctx, ...module }, own: { ...meta!, properties: rest } }
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
  const rebased = relative(dirname(toFile), resolve(dirname(fromFile), specifier));
  return rebased.startsWith('.') ? rebased : `./${rebased}`;
};

// The object literal a module exports under `exportName`, written out or as a `const`.
function exportedObject(editor: SourceEditor, exportName: string): E.ObjectExpression | undefined {
  const objectOf = (node: Node | null | undefined): E.ObjectExpression | undefined => {
    const value = node && unwrapExpression(node);
    if (value?.type === 'ObjectExpression') {
      return value;
    }
    const binding =
      value?.type === 'Identifier' ? editor.scopes.program.bindings.get(value.name) : undefined;
    return binding?.constant && binding.node.type === 'VariableDeclarator'
      ? objectOf(binding.node.init)
      : undefined;
  };
  for (const statement of editor.program.body) {
    if (statement.type === 'ExportDefaultDeclaration' && exportName === 'default') {
      return objectOf(statement.declaration as Node);
    }
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.declaration?.type === 'VariableDeclaration'
    ) {
      const declarator = statement.declaration.declarations.find(
        (candidate) => candidate.id.type === 'Identifier' && candidate.id.name === exportName
      );
      if (declarator) {
        return objectOf(declarator.init);
      }
    }
  }
  return undefined;
}
