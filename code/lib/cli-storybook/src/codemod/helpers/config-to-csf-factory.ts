import { types as t } from 'storybook/internal/babel';
import { formatFileContent } from 'storybook/internal/common';
import { loadConfig, printConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { FileInfo } from '../../automigrate/codemod';
import {
  cleanupTypeImports,
  getConfigProperties,
  removeExportDeclarations,
} from './csf-factories-utils';

export async function configToCsfFactory(
  info: FileInfo,
  { configType, frameworkPackage }: { configType: 'main' | 'preview'; frameworkPackage: string },
  { dryRun = false, skipFormatting = false }: { dryRun?: boolean; skipFormatting?: boolean } = {}
) {
  const config = loadConfig(info.source);
  try {
    config.parse();
  } catch (err) {
    logger.log(`Error when parsing ${info.path}, skipping:\n${err}`);
    return info.source;
  }

  const methodName = configType === 'main' ? 'defineMain' : 'definePreview';
  const programNode = config._ast.program;
  const exportDecls = config._exportDecls;

  const defineConfigProps = getConfigProperties(exportDecls, { configType });
  const hasNamedExports = defineConfigProps.length > 0;

  function findDeclarationNodeIndex(declarationName: string): number {
    return programNode.body.findIndex(
      (n) =>
        t.isVariableDeclaration(n) &&
        n.declarations.some((d) => {
          let declaration = d.init;
          // unwrap TS type annotations
          if (t.isTSAsExpression(declaration) || t.isTSSatisfiesExpression(declaration)) {
            declaration = declaration.expression;
          }
          return (
            t.isIdentifier(d.id) &&
            d.id.name === declarationName &&
            t.isObjectExpression(declaration)
          );
        })
    );
  }

  /**
   * Scenario 1: Mixed exports
   *
   * ```
   * export const tags = [];
   * export default {
   *   parameters: {},
   * };
   * ```
   *
   * Transform into: `export default defineMain({ tags: [], parameters: {} })`
   */
  if (config._exportsObject && hasNamedExports) {
    // when merging named exports with default exports, add the named exports first in the list
    config._exportsObject.properties = [...defineConfigProps, ...config._exportsObject.properties];
    programNode.body = removeExportDeclarations(programNode, exportDecls);

    // After merging, ensure the default export is wrapped with defineMain/definePreview
    const defineConfigCall = t.callExpression(t.identifier(methodName), [config._exportsObject]);

    let exportDefaultNode = null as unknown as t.ExportDefaultDeclaration;
    let declarationNodeIndex = -1;

    programNode.body.forEach((node) => {
      // Detect Syntax 1: export default <identifier>
      if (t.isExportDefaultDeclaration(node) && t.isIdentifier(node.declaration)) {
        const declarationName = node.declaration.name;

        declarationNodeIndex = findDeclarationNodeIndex(declarationName);

        if (declarationNodeIndex !== -1) {
          exportDefaultNode = node;
          // remove the original declaration as it will become a default export
          const declarationNode = programNode.body[declarationNodeIndex];
          if (t.isVariableDeclaration(declarationNode)) {
            const id = declarationNode.declarations[0].id;
            const variableName = t.isIdentifier(id) && id.name;

            if (variableName) {
              programNode.body.splice(declarationNodeIndex, 1);
            }
          }
        }
      } else if (t.isExportDefaultDeclaration(node) && t.isObjectExpression(node.declaration)) {
        // Detect Syntax 2: export default { ... }
        exportDefaultNode = node;
      }
    });

    if (exportDefaultNode !== null) {
      exportDefaultNode.declaration = defineConfigCall;
    }
  } else if (config._exportsObject) {
    /**
     * Scenario 2: Default exports
     *
     * - Syntax 1: `const config = {}; export default config;`
     * - Syntax 2: `export default {};`
     *
     * Transform into: `export default defineMain({})`
     */
    const defineConfigCall = t.callExpression(t.identifier(methodName), [config._exportsObject]);

    let exportDefaultNode = null as any as t.ExportDefaultDeclaration;
    let declarationNodeIndex = -1;

    programNode.body.forEach((node) => {
      // Detect Syntax 1
      const declaration =
        t.isExportDefaultDeclaration(node) && config._unwrap(node.declaration as t.Node);

      if (t.isExportDefaultDeclaration(node) && t.isIdentifier(declaration)) {
        const declarationName = declaration.name;

        declarationNodeIndex = findDeclarationNodeIndex(declarationName);

        if (declarationNodeIndex !== -1) {
          exportDefaultNode = node;
          // remove the original declaration as it will become a default export
          const declarationNode = programNode.body[declarationNodeIndex];
          if (t.isVariableDeclaration(declarationNode)) {
            const id = declarationNode.declarations[0].id;
            const variableName = t.isIdentifier(id) && id.name;

            if (variableName) {
              programNode.body.splice(declarationNodeIndex, 1);
            }
          }
        }
      } else if (t.isExportDefaultDeclaration(node) && t.isObjectExpression(node.declaration)) {
        // Detect Syntax 2
        exportDefaultNode = node;
      }
    });

    if (exportDefaultNode !== null) {
      exportDefaultNode.declaration = defineConfigCall;
    }
  } else if (hasNamedExports) {
    /**
     * Scenario 3: Named exports export const foo = {}; export bar = '';
     *
     * Transform into: export default defineMain({ foo: {}, bar: '' });
     */
    // Construct the `define` call
    const defineConfigCall = t.callExpression(t.identifier(methodName), [
      t.objectExpression(defineConfigProps),
    ]);

    // Remove all related named exports
    programNode.body = removeExportDeclarations(programNode, exportDecls);

    // Add the new export default declaration
    programNode.body.push(t.exportDefaultDeclaration(defineConfigCall));
  } else if (configType === 'preview') {
    /**
     * Scenario 4: No exports (empty file or only side-effect imports)
     *
     * ```
     * import './preview.scss'
     * ```
     *
     * Transform into: `import './preview.scss'; export default definePreview({})`
     *
     * This is needed because story files using CSF factories import from preview,
     * so the preview file must have a default export.
     */
    const defineConfigCall = t.callExpression(t.identifier(methodName), [t.objectExpression([])]);
    programNode.body.push(t.exportDefaultDeclaration(defineConfigCall));
  }

  const configImport = t.importDeclaration(
    [t.importSpecifier(t.identifier(methodName), t.identifier(methodName))],
    t.stringLiteral(frameworkPackage + `${configType === 'main' ? '/node' : ''}`)
  );

  // Check whether @storybook/framework import already exists
  const existingImport = programNode.body.find(
    (node) =>
      t.isImportDeclaration(node) &&
      node.importKind !== 'type' &&
      node.source.value === configImport.source.value
  );

  if (existingImport && t.isImportDeclaration(existingImport)) {
    // If it does, check whether defineMain/definePreview is already imported
    // and only add it if it's not
    const hasMethodName = existingImport.specifiers.some(
      (specifier) =>
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        specifier.imported.name === methodName
    );

    if (!hasMethodName) {
      existingImport.specifiers.push(
        t.importSpecifier(t.identifier(methodName), t.identifier(methodName))
      );
    }
  } else {
    // if not, add import { defineMain } from '@storybook/framework'
    programNode.body.unshift(configImport);
  }

  // Remove type imports – now inferred – from @storybook/* packages
  const disallowList = ['StorybookConfig', 'Preview'];
  programNode.body = cleanupTypeImports(programNode, disallowList);

  const output = printConfig(config).code;

  if (dryRun) {
    logger.log(`Would write to ${picocolors.yellow(info.path)}:\n${picocolors.green(output)}`);
    return info.source;
  }

  return skipFormatting ? output : formatFileContent(info.path, output);
}
