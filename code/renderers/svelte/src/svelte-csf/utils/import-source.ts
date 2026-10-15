import { isValidPreviewPath } from 'storybook/internal/csf-tools';

import type * as ESTreeAST from 'estree';

import { SVELTE_CSF_IMPORT_SOURCES } from '../constants.ts';
import { isOneOf } from './is-one-of.ts';
import {
  MixedMetaError,
  MultipleMetaError,
  PreviewNotImportedError,
} from './error/parser/extract/svelte.ts';

export function isSvelteCsfImportSource(source: unknown): boolean {
  return typeof source === 'string' && isOneOf(SVELTE_CSF_IMPORT_SOURCES, source);
}

export interface MetaImports {
  defineMetaImport?: ESTreeAST.ImportSpecifier;
  hasDefaultOrNamespaceImport: boolean;
  // The local names of the imports from a preview file, such as `preview`
  previewNames: string[];
}

// Imports are only allowed at the top level, so there's no need to walk the whole AST
export function findMetaImports(body: ESTreeAST.Program['body']): MetaImports {
  const result: MetaImports = { hasDefaultOrNamespaceImport: false, previewNames: [] };

  for (const statement of body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }

    const { source, specifiers } = statement;

    if (typeof source.value === 'string' && isValidPreviewPath(source.value)) {
      result.previewNames.push(...specifiers.map((specifier) => specifier.local.name));
      continue;
    }

    if (!isSvelteCsfImportSource(source.value)) {
      continue;
    }

    for (const specifier of specifiers) {
      if (specifier.type !== 'ImportSpecifier') {
        result.hasDefaultOrNamespaceImport = true;
      } else if ('name' in specifier.imported && specifier.imported.name === 'defineMeta') {
        result.defineMetaImport = specifier;
      }
    }
  }

  return result;
}

export function hasMetaImport(imports: MetaImports): boolean {
  return !!imports.defineMetaImport || imports.previewNames.length > 0;
}

// `const { Story } = defineMeta({ … })`, `const { Story } = preview.meta({ … })`, or
// `const meta = preview.meta({ … })` followed by `const { Story } = meta` and
// `const { Story: IconStory } = meta.type<…>()`
export interface MetaNodes {
  // `preview.meta()` creates a CSF factories meta
  isFactory: boolean;
  declaration: ESTreeAST.VariableDeclaration;
  call: ESTreeAST.CallExpression;
  // For error messages, such as `defineMeta` or `preview.meta`
  functionName: string;
  // `meta` in `const meta = preview.meta({ … })`
  metaIdentifier?: ESTreeAST.Identifier;
  // The names of the `Story` components. They can be renamed: `const { Story: S } = …`
  storyNames: string[];
}

export function findMeta(
  body: ESTreeAST.Program['body'],
  imports: MetaImports,
  filename?: string
): MetaNodes | undefined {
  let meta: MetaNodes | undefined;

  for (const statement of body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }

    const { id, init } = statement.declarations[0];
    const functionName =
      init?.type === 'CallExpression' ? getMetaFunctionName(init, imports, filename) : undefined;

    if (init?.type === 'CallExpression' && functionName) {
      const isFactory = init.callee.type === 'MemberExpression';

      if (meta && meta.isFactory !== isFactory) {
        throw new MixedMetaError(filename);
      }

      // Two defineMeta() calls are allowed: the last one wins
      if (meta?.isFactory) {
        throw new MultipleMetaError(filename);
      }

      meta = {
        isFactory,
        declaration: statement,
        call: init,
        functionName,
        metaIdentifier: isFactory && id.type === 'Identifier' ? id : undefined,
        storyNames: findStoryNames(id),
      };
    } else if (meta?.metaIdentifier) {
      for (const declarator of statement.declarations) {
        const metaReference = declarator.init && skipTypeCalls(declarator.init);

        if (
          metaReference?.type === 'Identifier' &&
          metaReference.name === meta.metaIdentifier.name
        ) {
          meta.storyNames.push(...findStoryNames(declarator.id));
        }
      }
    }
  }

  return meta;
}

// The name of the function when the call is `defineMeta()` or `preview.meta()`
function getMetaFunctionName(
  call: ESTreeAST.CallExpression,
  imports: MetaImports,
  filename?: string
): string | undefined {
  const { callee } = call;

  if (callee.type === 'Identifier') {
    return callee.name === imports.defineMetaImport?.local.name ? callee.name : undefined;
  }

  if (
    callee.type !== 'MemberExpression' ||
    callee.computed ||
    callee.property.type !== 'Identifier' ||
    callee.property.name !== 'meta'
  ) {
    return undefined;
  }

  const object = skipTypeCalls(callee.object);

  if (object.type !== 'Identifier') {
    return undefined;
  }

  if (imports.previewNames.includes(object.name)) {
    return `${object.name}.meta`;
  }

  // Like `CsfFile`, only a variable named `preview` shows that the file tries to use CSF factories.
  // Other `.meta()` calls, such as Zod's, are not a meta.
  if (object.name === 'preview') {
    throw new PreviewNotImportedError(filename);
  }

  return undefined;
}

// `preview.type<…>()` and `meta.type<…>()` return the same preview or meta with more types, so
// `preview.type<…>().meta()` is a meta of `preview`, and `meta.type<…>()` is `meta`
function skipTypeCalls(expression: ESTreeAST.Expression | ESTreeAST.Super) {
  let current = expression;

  while (
    current.type === 'CallExpression' &&
    current.arguments.length === 0 &&
    current.callee.type === 'MemberExpression' &&
    !current.callee.computed &&
    current.callee.property.type === 'Identifier' &&
    current.callee.property.name === 'type'
  ) {
    current = current.callee.object;
  }

  return current;
}

function findStoryNames(id: ESTreeAST.Pattern): string[] {
  if (id.type !== 'ObjectPattern') {
    return [];
  }

  return id.properties.flatMap((property) =>
    property.type === 'Property' &&
    property.key.type === 'Identifier' &&
    property.key.name === 'Story' &&
    property.value.type === 'Identifier'
      ? [property.value.name]
      : []
  );
}
