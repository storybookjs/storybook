import type { IncludeExcludeOptions } from './csf-helpers.ts';
import { isExportStory, isValidPreviewPath } from './csf-helpers.ts';

import type { TSESTree } from '@typescript-eslint/types';
import type { TSESLint } from '@typescript-eslint/utils';

import {
  ASTUtils,
  isCallExpression,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isMemberExpression,
  isObjectExpression,
  isSpreadElement,
  isTSAsExpression,
  isTSNonNullExpression,
  isTSSatisfiesExpression,
  isTSTypeAssertion,
  isVariableDeclaration,
  isVariableDeclarator,
} from './ast.ts';

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

export const docsUrl = (ruleName: string) =>
  `https://github.com/storybookjs/storybook/blob/next/code/lib/eslint-plugin/docs/rules/${ruleName}.md`;

const getScope = (context: RuleContext, node: TSESTree.Node) =>
  // Compatibility implementation for eslint v8.x and v9.x or later
  // see https://eslint.org/blog/2023/09/preparing-custom-rules-eslint-v9/#context.getscope()
  context.sourceCode.getScope ? context.sourceCode.getScope(node) : context.getScope();

/**
 * Peel the TS wrappers csf-tools peels off meta and story initializers: `x as T`, `x satisfies T`,
 * and `x satisfies T as U` — deliberately not `!` or deeper nesting, which csf-tools rejects.
 */
export const unwrapCsfTSWrappers = (node: TSESTree.Node): TSESTree.Node => {
  if (isTSAsExpression(node) && isTSSatisfiesExpression(node.expression)) {
    return node.expression.expression;
  }
  if (isTSAsExpression(node) || isTSSatisfiesExpression(node)) {
    return node.expression;
  }
  return node;
};

export const getMetaObjectExpression = (
  node: TSESTree.ExportDefaultDeclaration,
  context: RuleContext
) => {
  let meta: TSESTree.Node | null = node.declaration;
  if (isIdentifier(meta)) {
    const variable = ASTUtils.findVariable(getScope(context, node), meta.name);
    const decl = variable && variable.defs.find((def) => isVariableDeclarator(def.node));
    if (decl && isVariableDeclarator(decl.node)) {
      meta = decl.node.init;
    }
  }
  if (meta) {
    meta = unwrapCsfTSWrappers(meta);
  }

  return isObjectExpression(meta) ? meta : null;
};

export const unwrapTSExpression = (node: TSESTree.Node): TSESTree.Node =>
  isTSAsExpression(node) ||
  isTSSatisfiesExpression(node) ||
  isTSNonNullExpression(node) ||
  isTSTypeAssertion(node)
    ? unwrapTSExpression(node.expression)
    : node;

/**
 * Initializer of the variable an identifier refers to, when csf-tools would resolve it: a single
 * `VariableDeclarator` in this file, optionally required to never be reassigned.
 */
export const resolveIdentifierInit = (
  context: RuleContext,
  identifier: TSESTree.Identifier,
  { requireConstant = false } = {}
): TSESTree.Expression | null => {
  const variable = ASTUtils.findVariable(getScope(context, identifier), identifier.name);
  const def = variable?.defs.length === 1 ? variable.defs[0] : undefined;
  if (!def || !isVariableDeclarator(def.node) || !def.node.init) {
    return null;
  }
  if (requireConstant && variable?.references.some((ref) => ref.isWrite() && !ref.init)) {
    return null;
  }
  return def.node.init;
};

export interface FactoryMetaCall {
  /** False when the root is named `preview` but imported from a non-preview path (csf-tools errors). */
  validPreviewImport: boolean;
  /** The meta object csf-tools can read statically; null means it falls back to an empty meta. */
  metaObject: TSESTree.ObjectExpression | null;
}

/**
 * Interpret a call as a CSF factory meta call (`preview.meta({ ... })`), mirroring csf-tools: the
 * root of the callee chain must be an identifier imported from a `.storybook/preview` path, and the
 * argument resolves through TS assertions and a constant local variable. Returns null for calls
 * csf-tools ignores (member `.meta()` calls on anything else, e.g. Zod schemas).
 */
export const parseFactoryMetaCall = (
  node: TSESTree.CallExpression,
  context: RuleContext
): FactoryMetaCall | null => {
  const { callee } = node;
  if (
    !isMemberExpression(callee) ||
    callee.computed ||
    !isIdentifier(callee.property) ||
    callee.property.name !== 'meta'
  ) {
    return null;
  }

  // `preview.meta()` and `preview.type<...>().meta()` both root at `preview`
  let root: TSESTree.Node = callee.object;
  if (isCallExpression(root) && isMemberExpression(root.callee)) {
    root = root.callee.object;
  }
  if (!isIdentifier(root)) {
    return null;
  }

  const variable = ASTUtils.findVariable(getScope(context, root), root.name);
  const importDeclaration = variable?.defs
    .map((def) => def.parent)
    .find((parent) => isImportDeclaration(parent));
  if (!importDeclaration || typeof importDeclaration.source.value !== 'string') {
    return null;
  }

  if (!isValidPreviewPath(importDeclaration.source.value)) {
    return root.name === 'preview' ? { validPreviewImport: false, metaObject: null } : null;
  }

  const [argument] = node.arguments;
  let resolved: TSESTree.Node | null = argument ?? null;
  if (argument && isIdentifier(argument)) {
    resolved = resolveIdentifierInit(context, argument, { requireConstant: true }) ?? argument;
  }
  const unwrapped = resolved && unwrapTSExpression(resolved);
  return {
    validPreviewImport: true,
    metaObject: unwrapped && isObjectExpression(unwrapped) ? unwrapped : null,
  };
};

/** The statically readable meta object of a CSF factory meta call, when the call is one. */
export const getFactoryMetaObjectExpression = (
  node: TSESTree.CallExpression,
  context: RuleContext
): TSESTree.ObjectExpression | null => {
  const factoryMeta = parseFactoryMetaCall(node, context);
  return factoryMeta?.validPreviewImport ? factoryMeta.metaObject : null;
};

/** Whether an expression is a CSF factory story call: `meta.story({ ... })` or `meta.extend()`. */
export const isCsfFactoryStoryCall = (
  node: TSESTree.Node | null | undefined
): node is TSESTree.CallExpression =>
  isCallExpression(node) &&
  isMemberExpression(node.callee) &&
  !node.callee.computed &&
  isIdentifier(node.callee.property) &&
  ['story', 'extend'].includes(node.callee.property.name);

/**
 * Whether an exported identifier produces a story in a factory file: only `meta.story()` /
 * `meta.extend()` declarations do, while `export { X }` specifiers are indexed regardless of their
 * initializer.
 */
export const isFactoryStoryExport = (id: TSESTree.Identifier) =>
  id.parent?.type === 'ExportSpecifier' ||
  (isVariableDeclarator(id.parent) &&
    !!id.parent.init &&
    isCsfFactoryStoryCall(unwrapTSExpression(id.parent.init)));

export const getDescriptor = (
  metaDeclaration: TSESTree.ObjectExpression,
  propertyName: string
): string[] | RegExp | undefined => {
  const property =
    metaDeclaration &&
    metaDeclaration.properties.find(
      (p) => 'key' in p && 'name' in p.key && p.key.name === propertyName
    );

  if (!property || isSpreadElement(property)) {
    return undefined;
  }

  const { type } = property.value;

  switch (type) {
    case 'ArrayExpression':
      return property.value.elements.map((t) => {
        if (t === null) {
          throw new Error(`Unexpected descriptor element: null`);
        }
        if (!['StringLiteral', 'Literal'].includes(t.type)) {
          throw new Error(`Unexpected descriptor element: ${t.type}`);
        }
        // @ts-expect-error TODO: t should be only StringLiteral or Literal, and the type is not resolving correctly
        return t.value;
      });
    case 'Literal':
    // @ts-expect-error TODO: Investigation needed. Type systems says, that "RegExpLiteral" does not exist
    case 'RegExpLiteral':
      // @ts-expect-error TODO: investigation needed
      return property.value.value;
    default:
      throw new Error(`Unexpected descriptor: ${type}`);
  }
};

export const isValidStoryExport = (
  node: TSESTree.Identifier,
  nonStoryExportsConfig: IncludeExcludeOptions
) => isExportStory(node.name, nonStoryExportsConfig) && node.name !== '__namedExportsOrder';

export const getAllNamedExports = (node: TSESTree.ExportNamedDeclaration) => {
  // e.g. `export { MyStory }`
  if (!node.declaration && node.specifiers) {
    return node.specifiers.reduce((acc, specifier) => {
      if (isIdentifier(specifier.exported)) {
        acc.push(specifier.exported);
      }
      return acc;
    }, [] as TSESTree.Identifier[]);
  }

  const decl = node.declaration;
  if (isVariableDeclaration(decl)) {
    const declaration = decl.declarations[0];

    if (declaration) {
      const { id } = declaration;
      // e.g. `export const MyStory`
      if (isIdentifier(id)) {
        return [id];
      }
    }
  }

  if (isFunctionDeclaration(decl)) {
    // e.g. `export function MyStory() {}`
    if (isIdentifier(decl.id)) {
      return [decl.id];
    }
  }

  return [];
};
