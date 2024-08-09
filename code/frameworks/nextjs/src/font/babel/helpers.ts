import type * as BabelCoreNamespace from '@babel/core';
import type * as BabelTypesNamespace from '@babel/types';

type BabelTypes = typeof BabelTypesNamespace;
type PrimaryTypes = Record<string, any> | string | number | boolean | undefined | null;

export type JSReturnValue = PrimaryTypes | Array<PrimaryTypes>;

export type VariableMeta = {
  /**
   * Variable Declaration name of the assigned function call
   * @example
   * import { Roboto } from 'next/font/google'
   * const robotoName = Roboto({
   *   weight: '400'
   * })
   *
   * // identifierName = 'robotName'
   */
  identifierName: string;
  /**
   * Properties of the assigned function call
   * @example
   * import { Roboto } from 'next/font/google'
   * const robotoName = Roboto({
   *   weight: '400'
   * })
   *
   * // properties = { weight: '400' }
   */
  properties: JSReturnValue;
  /**
   * Function name of the imported next/font/google function
   * @example
   * import { Roboto } from 'next/font/google'
   * const robotoName = Roboto({
   *   weight: '400'
   * })
   *
   * // functionName = Roboto
   */
  functionName: string;
};

function convertNodeToJSON(types: BabelTypes, node: any): JSReturnValue {
  if (types.isBooleanLiteral(node) || types.isStringLiteral(node) || types.isNumericLiteral(node)) {
    return node.value;
  }

  if (node.name === 'undefined' && !node.value) {
    return undefined;
  }

  if (types.isNullLiteral(node)) {
    return null;
  }

  if (types.isObjectExpression(node)) {
    return computeProps(types, node.properties);
  }

  if (types.isArrayExpression(node)) {
    return node.elements.reduce(
      (acc, element) => [
        ...acc,
        ...(element?.type === 'SpreadElement'
          ? (convertNodeToJSON(types, element.argument) as PrimaryTypes[])
          : [convertNodeToJSON(types, element)]),
      ],
      [] as PrimaryTypes[]
    );
  }

  return {};
}

function computeProps(
  types: BabelTypes,
  props: (
    | BabelTypesNamespace.ObjectMethod
    | BabelTypesNamespace.ObjectProperty
    | BabelTypesNamespace.SpreadElement
  )[]
) {
  return props.reduce((acc, prop) => {
    if (prop.type === 'SpreadElement') {
      return {
        ...acc,
        ...(convertNodeToJSON(types, prop.argument) as Record<string, any>),
      };
    }
    if (prop.type !== 'ObjectMethod') {
      const val = convertNodeToJSON(types, prop.value);
      if (val !== undefined && types.isIdentifier(prop.key)) {
        return {
          ...acc,
          [prop.key.name]: val,
        };
      }
    }
    return acc;
  }, {});
}

export function isDefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}

/**
 * Removes transformed variable declarations, which were already replaced with parameterized imports
 * @example
 * // AST
 * import { Roboto, Inter } from 'next/font/google'
 * const interName = Inter({
 *  subsets: ['latin'],
 * })
 * const robotoName = Roboto({
 *   weight: '400'
 * })
 *
 * // Result
 * import { Roboto, Inter } from 'next/font/google'
 *
 * // Variable declarations are removed
 */
export function removeTransformedVariableDeclarations(
  path: BabelCoreNamespace.NodePath<BabelCoreNamespace.types.ImportDeclaration>,
  types: BabelTypes,
  metas: VariableMeta[]
) {
  path.parentPath.traverse({
    ExportNamedDeclaration(declaratorPath) {
      if (!declaratorPath.parentPath?.isProgram()) {
        return;
      }

      metas.forEach((meta) => {
        if (
          types.isVariableDeclaration(declaratorPath.node.declaration) &&
          declaratorPath.node.declaration.declarations.length === 1 &&
          types.isVariableDeclarator(declaratorPath.node.declaration.declarations[0]) &&
          types.isIdentifier(declaratorPath.node.declaration.declarations[0].id) &&
          meta.identifierName === declaratorPath.node.declaration.declarations[0].id.name
        ) {
          declaratorPath.replaceWith(
            types.exportNamedDeclaration(null, [
              types.exportSpecifier(
                types.identifier(meta.identifierName),
                types.identifier(meta.identifierName)
              ),
            ])
          );
        }
      });
    },
    VariableDeclarator(declaratorPath) {
      if (!declaratorPath.parentPath.parentPath?.isProgram()) {
        return;
      }

      if (
        metas.some(
          (meta) =>
            types.isIdentifier(declaratorPath.node.id) &&
            meta.identifierName === declaratorPath.node.id.name
        )
      ) {
        declaratorPath.remove();
      }
    },
  });
}

/**
 * Replaces `next/font` import with a parameterized import
 * @example
 * // AST of src/example.js
 * import { Roboto, Inter } from 'next/font/google'
 * const interName = Inter({
 *  subsets: ['latin'],
 * })
 * const robotoName = Roboto({
 *   weight: '400'
 * })
 *
 * // Result
 * import interName from 'storybook-nextjs-font-loader?{filename: "src/example.js", source: "next/font/google", fontFamily: "Inter", props: {"subsets":["latin"]}}!next/font/google'
 * import robotoName from 'storybook-nextjs-font-loader?{filename: "src/example.js", source: "next/font/google", fontFamily: "Roboto", props: {"weight": "400"}}!next/font/google'
 *
 * // Following code will be removed from removeUnusedVariableDeclarations function
 * const interName = Inter({
 *  subsets: ['latin'],
 * })
 *
 * const robotoName = Roboto({
 *   weight: '400'
 * })
 */
export function replaceImportWithParamterImport(
  path: BabelCoreNamespace.NodePath<BabelCoreNamespace.types.ImportDeclaration>,
  types: BabelTypes,
  source: BabelCoreNamespace.types.StringLiteral,
  metas: Array<VariableMeta>,
  filename: string
) {
  // Add an import for each specifier with parameters
  path.replaceWithMultiple([
    ...metas.map((meta) => {
      return types.importDeclaration(
        [types.importDefaultSpecifier(types.identifier(meta.identifierName))],
        types.stringLiteral(
          `storybook-nextjs-font-loader?${JSON.stringify({
            source: source.value,
            props: meta.properties,
            fontFamily: meta.functionName,
            filename,
          })}!${source.value}`
        )
      );
    }),
  ]);
}

/**
 * Get meta information for the provided import specifier
 * @example
 * // AST
 * import { Roboto, Inter } from 'next/font/google'
 * const interName = Inter({
 *  subsets: ['latin'],
 * })
 * const robotoName = Roboto({
 *   weight: '400'
 * })
 *
 * // Return value
 * const variableMetas = [{
 *   identifierName: 'interName',
 *   properties: { subsets: ['latin'] },
 *   functionName: 'Inter'
 * }, {
 *   identifierName: 'robotoName',
 *   properties: { weight: '400' },
 *   functionName: 'Roboto'
 * }]
 */
export function getVariableMetasBySpecifier(
  program: BabelCoreNamespace.NodePath<BabelCoreNamespace.types.Program>,
  types: BabelTypes,
  specifier:
    | BabelCoreNamespace.types.ImportDefaultSpecifier
    | BabelCoreNamespace.types.ImportNamespaceSpecifier
    | BabelCoreNamespace.types.ImportSpecifier
) {
  return program.node.body
    .map((statement) => {
      if (!types.isVariableDeclaration(statement) && !types.isExportNamedDeclaration(statement)) {
        return undefined;
      }

      const exportedNamedDeclaration =
        !types.isVariableDeclaration(statement) &&
        types.isVariableDeclaration(statement.declaration) &&
        statement.declaration.declarations.length === 1
          ? statement.declaration.declarations[0]
          : null;

      const declaration = types.isVariableDeclaration(statement)
        ? statement.declarations[0]
        : exportedNamedDeclaration;

      if (!declaration) {
        return undefined;
      }

      if (!types.isIdentifier(declaration.id)) {
        return undefined;
      }

      if (!types.isCallExpression(declaration.init)) {
        return undefined;
      }

      if (!types.isIdentifier(declaration.init.callee)) {
        return undefined;
      }

      if (
        (specifier.type !== 'ImportSpecifier' ||
          specifier.imported.type !== 'Identifier' ||
          (declaration.init.callee.name !== specifier.imported.name &&
            declaration.init.callee.name !== specifier.local.name)) &&
        (specifier.type !== 'ImportDefaultSpecifier' ||
          declaration.init.callee.name !== specifier.local.name)
      ) {
        return undefined;
      }

      const options = declaration.init.arguments[0];

      if (!types.isObjectExpression(options)) {
        throw program.buildCodeFrameError(
          'Please pass an options object to the call expression of next/font functions'
        );
      }

      options.properties.forEach((property) => {
        if (types.isSpreadElement(property)) {
          throw program.buildCodeFrameError(
            'Please do not use spread elements in the options object in next/font function calls'
          );
        }
      });

      const identifierName = declaration.id.name;
      const properties = convertNodeToJSON(types, options);
      let functionName = declaration.init.callee.name;
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported &&
        specifier.imported.type === 'Identifier' &&
        declaration.init.callee.name !== specifier.imported.name
      ) {
        functionName = specifier.imported.name;
      }
      return { identifierName, properties, functionName };
    })
    .filter(isDefined);
}
