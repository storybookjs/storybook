import { readFileSync, writeFileSync } from 'node:fs';

import { types as t } from 'storybook/internal/babel';
import {
  formatFileContent,
  getAddonNames,
  removeAddon,
  HandledError,
} from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

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

  const statements = callsToInject.map((call) => t.expressionStatement(call));
  const beforeEachField = previewConfig.get(['beforeEach']);
  if (!beforeEachField && Object.hasOwn(previewConfig._exportDecls, 'beforeEach')) {
    throw new HandledError(
      'Cannot add console spies because beforeEach is exported separately from the default export'
    );
  }
  if (!beforeEachField) {
    previewConfig.set(
      ['beforeEach'],
      t.functionExpression(t.identifier('beforeEach'), [], t.blockStatement(statements))
    );
  } else {
    previewConfig.transform(['beforeEach'], (beforeEach) => {
      if (!t.isFunctionExpression(beforeEach) && !t.isArrowFunctionExpression(beforeEach)) {
        throw new HandledError(
          'Cannot add console spies because beforeEach is not an inline function'
        );
      }
      const body = t.isBlockStatement(beforeEach.body)
        ? { ...beforeEach.body, body: [...beforeEach.body.body, ...statements] }
        : t.blockStatement([...statements, t.returnStatement(beforeEach.body)]);
      return { ...beforeEach, body };
    });
  }
  assertConfigMutationSuccess(previewConfig);

  return formatFileContent(filePath, formatConfig(previewConfig));
}
