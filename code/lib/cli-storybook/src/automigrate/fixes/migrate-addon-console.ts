import { readFileSync, writeFileSync } from 'node:fs';

import { types as t } from 'storybook/internal/babel';
import { formatFileContent, getAddonNames, removeAddon } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { Fix } from '../types';

export interface MigrateAddonConsoleOptions {
  transformedPreviewCode: string | undefined;
}

/** Remove @storybook/addon-console since it's now part of Storybook core. */
export const migrateAddonConsole: Fix<MigrateAddonConsoleOptions> = {
  id: 'migrate-addon-console',
  link: 'https://github.com/storybookjs/storybook/discussions/31657',

  async check({ mainConfig, packageManager, previewConfigPath }) {
    const addons = getAddonNames(mainConfig);
    const consoleAddon = '@storybook/addon-console';

    const hasConsoleAddon = addons.some((addon) => addon.includes(consoleAddon));
    const hasConsoleAddonInDeps = packageManager.isDependencyInstalled(consoleAddon);

    if (!hasConsoleAddon && !hasConsoleAddonInDeps) {
      return null;
    }

    const transformedPreviewCode = previewConfigPath
      ? await transformPreviewFile(readFileSync(previewConfigPath, 'utf8'), previewConfigPath)
      : undefined;

    return {
      transformedPreviewCode,
    };
  },

  prompt() {
    return '@storybook/addon-console can now be implemented with spies on the console object.';
  },

  async run({ packageManager, dryRun, configDir, previewConfigPath, result }) {
    const { transformedPreviewCode } = result;
    if (!dryRun) {
      if (!previewConfigPath) {
        logger.debug(
          'addon-console was installed but no preview file was found. Creating a preview file.'
        );
      }

      const finalPreviewPath = previewConfigPath || `${configDir}/preview.ts`;
      const finalTransformedCode =
        transformedPreviewCode || (await transformPreviewFile('', finalPreviewPath));

      logger.debug('Updating preview file to replace addon-console logic with spies.');
      writeFileSync(finalPreviewPath, finalTransformedCode, 'utf8');

      logger.debug('Removing @storybook/addon-console addon.');
      await removeAddon('@storybook/addon-console', {
        configDir,
        skipInstall: true,
        packageManager,
      });
    }
  },
};

export async function transformPreviewFile(source: string, filePath: string): Promise<string> {
  const previewConfig = loadConfig(source).parse();

  // We import spyOn so we can use it.
  previewConfig.setImport(['spyOn'], 'storybook/test');

  // addon-console required its users to import it in preview instead of
  // the usual addon loading mechanism.
  previewConfig.removeImport(null, '@storybook/addon-console');

  // Construct spies for all relevant console methods, to provide named mocks for the actions addon.
  const callsToInject = [];
  for (const method of [
    'log',
    'warn',
    'error',
    'info',
    'debug',
    'trace',
    'count',
    'dir',
    'assert',
  ]) {
    callsToInject.push(
      t.callExpression(
        t.memberExpression(
          t.callExpression(t.identifier('spyOn'), [
            t.identifier('console'),
            t.stringLiteral(method),
          ]),
          t.identifier('mockName')
        ),
        [t.stringLiteral(`console.${method}`)]
      )
    );
  }

  // Fetch default export, as we'll need it to decide where to inject beforeEach if
  // it doesn't already exist.
  const defaultExport = previewConfig.hasDefaultExport
    ? previewConfig._ast.program.body.find((node) => t.isExportDefaultDeclaration(node))
    : undefined;

  // We now add spies to beforeEach, accounting for various edge cases.
  // Find beforeEach export.
  let beforeEach = previewConfig.getFieldNode(['beforeEach']);

  // Find a `beforeEach` export because `function beforeEach() {}` is missed by getFieldNode.
  if (!beforeEach) {
    const beforeEachExport = previewConfig._ast.program.body.find(
      (
        node
      ): node is t.ExportNamedDeclaration & {
        declaration: t.FunctionDeclaration;
      } =>
        t.isExportNamedDeclaration(node) &&
        t.isFunctionDeclaration(node.declaration) &&
        node.declaration.id?.name === 'beforeEach'
    );
    if (beforeEachExport) {
      beforeEach = beforeEachExport.declaration;
    }
  }

  // Find `beforeEach` in default export properties.
  if (!beforeEach && defaultExport) {
    if (t.isIdentifier(defaultExport.declaration)) {
      const identifierName = defaultExport.declaration.name;
      const variableDeclarations = previewConfig._ast.program.body.filter((node) =>
        t.isVariableDeclaration(node)
      );
      for (const declaration of variableDeclarations) {
        for (const declarator of declaration.declarations) {
          if (
            t.isVariableDeclarator(declarator) &&
            t.isIdentifier(declarator.id, { name: identifierName })
          ) {
            if (t.isObjectExpression(declarator.init)) {
              beforeEach = declarator.init.properties.find(
                (prop): prop is t.ObjectMethod =>
                  t.isObjectMethod(prop) && t.isIdentifier(prop.key, { name: 'beforeEach' })
              );

              if (!beforeEach) {
                const beforeEachProperty = declarator.init.properties.find(
                  (prop): prop is t.ObjectProperty =>
                    t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: 'beforeEach' })
                );
                if (beforeEachProperty && t.isFunctionExpression(beforeEachProperty.value)) {
                  beforeEach = beforeEachProperty.value;
                }
                if (beforeEachProperty && t.isIdentifier(beforeEachProperty.value)) {
                  const identifierName = beforeEachProperty.value.name;
                  beforeEach = previewConfig._ast.program.body.find(
                    (node): node is t.FunctionDeclaration | t.VariableDeclaration =>
                      (t.isFunctionDeclaration(node) && node.id?.name === identifierName) ||
                      (t.isVariableDeclaration(node) &&
                        node.declarations.some(
                          (decl) =>
                            t.isVariableDeclarator(decl) &&
                            t.isIdentifier(decl.id, { name: identifierName }) &&
                            (t.isFunctionExpression(decl.init) ||
                              t.isArrowFunctionExpression(decl.init))
                        ))
                  );
                }
              }
            }
          }
        }
      }
    }

    if (t.isObjectExpression(defaultExport.declaration)) {
      beforeEach = previewConfig.getFieldNode(['default', 'beforeEach']);
    }
  }

  // If no beforeEach is found, we create a new one.
  if (!beforeEach) {
    beforeEach = t.functionExpression(t.identifier('beforeEach'), [], t.blockStatement([]));

    // If we have a default export and it's an object, we add beforeEach to it,
    // else we export beforeEach as a named export.
    if (defaultExport && t.isObjectExpression(defaultExport.declaration)) {
      defaultExport.declaration.properties.push(
        t.objectProperty(t.identifier('beforeEach'), beforeEach)
      );
    } else {
      previewConfig._ast.program.body.push(
        t.exportNamedDeclaration(
          t.variableDeclaration('const', [
            t.variableDeclarator(t.identifier('beforeEach'), beforeEach),
          ])
        )
      );
    }
  }

  if (
    t.isFunctionDeclaration(beforeEach) ||
    t.isFunctionExpression(beforeEach) ||
    t.isArrowFunctionExpression(beforeEach) ||
    t.isObjectMethod(beforeEach)
  ) {
    const functionBody = beforeEach.body;
    if (t.isBlockStatement(functionBody)) {
      functionBody.body.push(...callsToInject.map((call) => t.expressionStatement(call)));
    } else {
      beforeEach.body = t.blockStatement([
        ...callsToInject.map((call) => t.expressionStatement(call)),
        t.returnStatement(functionBody),
      ]);
    }
  }

  return formatFileContent(filePath, formatConfig(previewConfig));
}
