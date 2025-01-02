import { rendererPackages } from 'storybook/internal/common';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as jscodeshift from 'jscodeshift';
import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

// Relative path import to avoid dependency to @storybook/test
import {
  SUPPORTED_FRAMEWORKS,
  SUPPORTED_RENDERERS,
} from '../../../../../addons/test/src/constants';
import { getAddonNames, getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

export const vitestFileExtensions = ['.js', '.ts', '.cts', '.mts', '.cjs', '.mjs'] as const;

interface AddonA11yAddonTestOptions {
  setupFile: string | null;
  transformedSetupCode: string | null;
}

/**
 * If addon-a11y and experimental-addon-test are already installed, we need to update
 * `.storybook/vitest.setup.<ts|js>` to set up project annotations from addon-a11y. If we can't find
 * `.storybook/vitest.setup.<ts|js>`, we need to set up a notification to the user to manually
 * update the file.
 */
export const addonA11yAddonTest: Fix<AddonA11yAddonTestOptions> = {
  id: 'addonA11yAddonTest',
  versionRange: ['<8.5.0', '>=8.5.0'],

  promptType(result) {
    if (result.setupFile === null) {
      return 'manual';
    }

    return 'auto';
  },

  async check({ mainConfig, configDir }) {
    const addons = getAddonNames(mainConfig);

    const frameworkPackageName = getFrameworkPackageName(mainConfig);
    const rendererPackageName = getRendererName(mainConfig);

    const hasA11yAddon = !!addons.find((addon) => addon.includes('@storybook/addon-a11y'));
    const hasTestAddon = !!addons.find((addon) =>
      addon.includes('@storybook/experimental-addon-test')
    );

    if (
      !SUPPORTED_FRAMEWORKS.find((framework) => frameworkPackageName?.includes(framework)) &&
      !SUPPORTED_RENDERERS.find((renderer) =>
        rendererPackageName?.includes(rendererPackages[renderer])
      )
    ) {
      return null;
    }

    if (!hasA11yAddon || !hasTestAddon || !configDir) {
      return null;
    }

    // get `${configDir}/vitest.setup.<ts|js>` absolute file path
    const vitestSetupFile =
      vitestFileExtensions
        .map((ext) => path.join(configDir, `vitest.setup${ext}`))
        .find((filePath) => existsSync(filePath)) ?? null;

    try {
      if (vitestSetupFile) {
        const source = readFileSync(vitestSetupFile, 'utf8');
        if (source.includes('@storybook/addon-a11y')) {
          return null;
        }
        const transformedSetupCode = transformSetupFile(source);
        return {
          setupFile: vitestSetupFile,
          transformedSetupCode,
        };
      } else {
        return {
          setupFile: null,
          transformedSetupCode: null,
        };
      }
    } catch (e) {
      return {
        setupFile: vitestSetupFile,
        transformedSetupCode: null,
      };
    }
  },

  prompt({ setupFile, transformedSetupCode }) {
    const introduction = dedent`
      We have detected that you have ${picocolors.magenta(`@storybook/addon-a11y`)} and ${picocolors.magenta(`@storybook/experimental-addon-test`)} installed.

      ${picocolors.magenta(`@storybook/addon-a11y`)} integrates now with ${picocolors.magenta(`@storybook/experimental-addon-test`)} to provide automatic accessibility checks for your stories, powered by Axe and Vitest.
    `;

    if (setupFile === null || transformedSetupCode === null) {
      return dedent`
      ${introduction}

      We couldn't find or automatically update your ${picocolors.cyan(`.storybook/vitest.setup.<ts|js>`)} in your project to smoothly set up project annotations from ${picocolors.magenta(`@storybook/addon-a11y`)}. 
      Please manually update your ${picocolors.cyan(`vitest.setup.ts`)} file to include the following:

      ${picocolors.gray('...')}   
      ${picocolors.green('+ import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";')}

      ${picocolors.gray('const annotations = setProjectAnnotations([')}
      ${picocolors.gray('  ...')}
      ${picocolors.green('+ a11yAddonAnnotations,')}
      ${picocolors.gray(']);')}

      ${picocolors.gray('beforeAll(annotations.beforeAll);')}

      For more information, please refer to the addon test documentation: 
      ${picocolors.cyan('https://storybook.js.org/docs/writing-tests/addon-test')}
      `;
    }

    const fileExtension = path.extname(setupFile);

    return dedent`
      We have detected that you have ${picocolors.magenta(`@storybook/addon-a11y`)} and ${picocolors.magenta(`@storybook/experimental-addon-test`)} installed.

      ${picocolors.magenta(`@storybook/addon-a11y`)} integrates now with ${picocolors.magenta(`@storybook/experimental-addon-test`)} to provide automatic accessibility checks for your stories, powered by Axe and Vitest.

      In order for these checks to be enabled we have to update your ${picocolors.cyan(`.storybook/vitest.setup${fileExtension}`)} file.
    `;
  },

  async run({ result }) {
    const { setupFile, transformedSetupCode } = result;

    if (!setupFile || !transformedSetupCode) {
      return;
    }

    // Write the transformed code back to the file
    writeFileSync(setupFile, transformedSetupCode, 'utf8');
  },
};

export function transformSetupFile(source: string) {
  const j = jscodeshift.withParser('ts');

  const root = j(source);

  // Import a11yAddonAnnotations
  const importDeclaration = j.importDeclaration(
    [j.importNamespaceSpecifier(j.identifier('a11yAddonAnnotations'))],
    j.literal('@storybook/addon-a11y/preview')
  );

  // Find the setProjectAnnotations call
  const setProjectAnnotationsCall = root.find(j.CallExpression, {
    callee: {
      type: 'Identifier',
      name: 'setProjectAnnotations',
    },
  });

  if (setProjectAnnotationsCall.length === 0) {
    throw new Error('Could not find setProjectAnnotations call in vitest.setup file');
  }

  // Add a11yAddonAnnotations to the annotations array or create a new array if argument is a string
  setProjectAnnotationsCall.forEach((p) => {
    if (p.value.arguments.length === 1 && p.value.arguments[0].type === 'ArrayExpression') {
      p.value.arguments[0].elements.unshift(j.identifier('a11yAddonAnnotations'));
    } else if (p.value.arguments.length === 1 && p.value.arguments[0].type === 'Identifier') {
      const arg = p.value.arguments[0];
      p.value.arguments[0] = j.arrayExpression([j.identifier('a11yAddonAnnotations'), arg]);
    }
  });

  // Add the import declaration at the top
  root.get().node.program.body.unshift(importDeclaration);

  return root.toSource();
}
