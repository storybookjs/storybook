import { formatFileContent } from 'storybook/internal/common';
import {
  type ESTree as E,
  appendStatement,
  type ESTreeNode as Node,
  loadConfig,
  objectList,
  prependToList,
  printConfig,
  printString,
  removeStatements,
  setImportSpecifiers,
  prependStatement,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { FileInfo } from '../../automigrate/codemod.ts';
import {
  cleanupTypeImports,
  getConfigProperties,
  removeExportDeclarations,
} from './csf-factories-utils.ts';

export async function configToCsfFactory(
  info: FileInfo,
  { configType, frameworkPackage }: { configType: 'main' | 'preview'; frameworkPackage: string },
  { dryRun = false, skipFormatting = false }: { dryRun?: boolean; skipFormatting?: boolean } = {}
) {
  const config = loadConfig(info.source, info.path);
  try {
    config.parse();
  } catch (err) {
    logger.log(`Error when parsing ${info.path}, skipping:\n${err}`);
    return info.source;
  }

  const methodName = configType === 'main' ? 'defineMain' : 'definePreview';
  const editor = config._editor;
  const exportDecls = config._exportDecls;

  const defineConfigProps = getConfigProperties(editor, exportDecls, { configType });
  const hasNamedExports = defineConfigProps.length > 0;

  // Early return if the code is already transformed (default export is already defineMain/definePreview)
  const isAlreadyTransformed = config._program.body.some((node) => {
    if (node.type !== 'ExportDefaultDeclaration') {
      return false;
    }
    const declaration = unwrapExpression(node.declaration);
    return (
      declaration?.type === 'CallExpression' &&
      declaration.callee.type === 'Identifier' &&
      declaration.callee.name === methodName
    );
  });

  // Check whether the required framework import (e.g. defineMain from '@storybook/react-vite/node') is already present
  const expectedImportSource = frameworkPackage + (configType === 'main' ? '/node' : '');
  const findFrameworkImport = () =>
    config._program.body.find(
      (node): node is E.ImportDeclaration =>
        node.type === 'ImportDeclaration' &&
        node.importKind !== 'type' &&
        node.source.value === expectedImportSource
    );
  const importsMethod = (node: E.ImportDeclaration | undefined) =>
    !!node?.specifiers.some(
      (spec) =>
        spec.type === 'ImportSpecifier' &&
        spec.imported.type === 'Identifier' &&
        spec.imported.name === methodName
    );
  const hasCorrectImport = importsMethod(findFrameworkImport());

  // For main configs, always return early when already transformed and imports are valid.
  // For preview configs, only return early when there are no named exports to merge.
  const shouldSkipTransform =
    configType === 'main' ? isAlreadyTransformed : isAlreadyTransformed && !hasNamedExports;

  if (shouldSkipTransform && hasCorrectImport) {
    return info.source;
  }

  const findObjectDeclaration = (declarationName: string) =>
    config._program.body.find(
      (n): n is E.VariableDeclaration =>
        n.type === 'VariableDeclaration' &&
        n.declarations.some(
          (d) =>
            d.id.type === 'Identifier' &&
            d.id.name === declarationName &&
            unwrapExpression(d.init)?.type === 'ObjectExpression'
        )
    );

  // Wraps the default export in `defineMain`/`definePreview`, moving a const declared config into it.
  const wrapDefaultExport = (unwrapIdentifier: boolean) => {
    const exportsObject = config._exportsObject;
    if (!exportsObject) {
      return;
    }
    const removed = new Set<Node>();
    for (const node of config._program.body) {
      if (node.type !== 'ExportDefaultDeclaration') {
        continue;
      }
      const declaration = unwrapIdentifier ? unwrapExpression(node.declaration) : node.declaration;
      if (declaration?.type === 'Identifier') {
        const declarationNode = findObjectDeclaration(declaration.name);
        if (!declarationNode) {
          continue;
        }
        removed.add(declarationNode);
      } else if (declaration?.type !== 'ObjectExpression') {
        continue;
      }
      editor.edits.overwrite(
        node.declaration.start,
        node.declaration.end,
        `${methodName}(${editor.source(exportsObject)})`
      );
    }
    removeStatements(editor, removed);
  };

  if (shouldSkipTransform) {
    // already transformed — skip transformation but still run import fixup below
  } else if (config._exportsObject && hasNamedExports) {
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
    // when merging named exports with default exports, add the named exports first in the list
    prependToList(editor, objectList(editor, config._exportsObject), defineConfigProps);
    removeExportDeclarations(editor, exportDecls);
    config._editor.commit();
    wrapDefaultExport(false);
  } else if (config._exportsObject) {
    /**
     * Scenario 2: Default exports
     *
     * - Syntax 1: `const config = {}; export default config;`
     * - Syntax 2: `export default {};`
     *
     * Transform into: `export default defineMain({})`
     */
    wrapDefaultExport(true);
  } else if (hasNamedExports) {
    /**
     * Scenario 3: Named exports export const foo = {}; export bar = '';
     *
     * Transform into: export default defineMain({ foo: {}, bar: '' });
     */
    removeExportDeclarations(editor, exportDecls);
    editor.edits.append(
      `\nexport default ${methodName}({\n${defineConfigProps.map((prop) => `  ${prop}`).join(',\n')}\n});`
    );
  } else if (configType === 'preview') {
    /**
     * Scenario 4: No exports (empty file or only side-effect imports)
     *
     * ```
     * import './preview.scss';
     * ```
     *
     * Transform into: `import './preview.scss'; export default definePreview({})`
     *
     * This is needed because story files using CSF factories import from preview, so the preview
     * file must have a default export.
     */
    appendStatement(editor, `export default ${methodName}({});`);
  }
  config._editor.commit();

  // Check whether @storybook/framework import already exists
  const existingImport = findFrameworkImport();
  if (existingImport) {
    // If it does, only add defineMain/definePreview if it's not imported yet
    if (!importsMethod(existingImport)) {
      setImportSpecifiers(editor, existingImport, existingImport.specifiers, {
        named: [methodName],
      });
    }
  } else {
    // if not, add import { defineMain } from '@storybook/framework'
    prependStatement(
      editor,
      `import { ${methodName} } from ${printString(expectedImportSource, editor.quote)};`
    );
  }
  config._editor.commit();

  // Remove type imports – now inferred – from @storybook/* packages
  const disallowList = ['StorybookConfig', 'Preview'];
  cleanupTypeImports(editor, disallowList);

  const output = printConfig(config).code;

  if (dryRun) {
    logger.log(`Would write to ${picocolors.yellow(info.path)}:\n${picocolors.green(output)}`);
    return info.source;
  }

  return skipFormatting ? output : formatFileContent(info.path, output);
}
