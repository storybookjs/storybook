import { formatFileContent, getAddonNames, rendererPackages } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import { type ArrayExpression } from '@babel/types';
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
import { getFrameworkPackageName, getRendererName } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

export const fileExtensions = [
  '.js',
  '.ts',
  '.cts',
  '.mts',
  '.cjs',
  '.mjs',
  '.jsx',
  '.tsx',
] as const;

interface AddonA11yAddonTestOptions {
  setupFile: string | null;
  previewFile: string | null;
  transformedSetupCode: string | null;
  transformedPreviewCode: string | null;
  skipVitestSetupTransformation: boolean;
  skipPreviewTransformation: boolean;
}

/**
 * If addon-a11y and experimental-addon-test are already installed, we need to update
 *
 * - `.storybook/vitest.setup.<ts|js>` to set up project annotations from addon-a11y.
 * - `.storybook/preview.<ts|js>` to set up tags.
 * - If we can't transform the files automatically, we'll prompt the user to do it manually.
 */
export const addonA11yAddonTest: Fix<AddonA11yAddonTestOptions> = {
  id: 'addonA11yAddonTest',
  versionRange: ['<8.5.0', '>=8.5.0'],

  promptType(result) {
    if (result.setupFile === null && result.previewFile === null) {
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

    const vitestSetupFile =
      fileExtensions
        .map((ext) => path.join(configDir, `vitest.setup${ext}`))
        .find((filePath) => existsSync(filePath)) ?? null;

    const previewFile =
      fileExtensions
        .map((ext) => path.join(configDir, `preview${ext}`))
        .find((filePath) => existsSync(filePath)) ?? null;

    let skipVitestSetupTransformation = false;
    let skipPreviewTransformation = false;

    if (vitestSetupFile && previewFile) {
      const vitestSetupSource = readFileSync(vitestSetupFile, 'utf8');
      const previewSetupSource = readFileSync(previewFile, 'utf8');

      skipVitestSetupTransformation = vitestSetupSource.includes('@storybook/addon-a11y');
      skipPreviewTransformation = !shouldPreviewFileBeTransformed(previewSetupSource);

      if (skipVitestSetupTransformation && skipPreviewTransformation) {
        return null;
      }
    }

    const getTransformedSetupCode = () => {
      if (!vitestSetupFile || skipVitestSetupTransformation) {
        return null;
      }

      try {
        const vitestSetupSource = readFileSync(vitestSetupFile, 'utf8');
        return transformSetupFile(vitestSetupSource);
      } catch (e) {
        return null;
      }
    };

    const getTransformedPreviewCode = () => {
      if (!previewFile || skipPreviewTransformation) {
        return null;
      }

      try {
        const previewSetupSource = readFileSync(previewFile, 'utf8');
        return transformPreviewFile(previewSetupSource, previewFile);
      } catch (e) {
        return null;
      }
    };

    return {
      setupFile: vitestSetupFile,
      previewFile: previewFile,
      transformedSetupCode: getTransformedSetupCode(),
      transformedPreviewCode: await getTransformedPreviewCode(),
      skipVitestSetupTransformation,
      skipPreviewTransformation,
    };
  },

  prompt({
    setupFile,
    previewFile,
    transformedSetupCode,
    transformedPreviewCode,
    skipPreviewTransformation,
    skipVitestSetupTransformation,
  }) {
    const introduction = dedent`
      We have detected that you have ${picocolors.magenta(`@storybook/addon-a11y`)} and ${picocolors.magenta(`@storybook/experimental-addon-test`)} installed.

      ${picocolors.magenta(`@storybook/addon-a11y`)} now integrates with ${picocolors.magenta(`@storybook/experimental-addon-test`)} to provide automatic accessibility checks for your stories, powered by Axe and Vitest.
    `;

    const prompt = [introduction];

    let counter = 1;

    if (!skipVitestSetupTransformation) {
      if (transformedSetupCode === null) {
        prompt.push(dedent`
          ${counter++}) We couldn't find or automatically update ${picocolors.cyan(`.storybook/vitest.setup.<ts|js>`)} in your project to smoothly set up project annotations from ${picocolors.magenta(`@storybook/addon-a11y`)}. 
          Please manually update your ${picocolors.cyan(`vitest.setup.ts`)} file to include the following:

          ${picocolors.gray('...')}   
          ${picocolors.green('+ import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";')}

          ${picocolors.gray('const annotations = setProjectAnnotations([')}
          ${picocolors.gray('  ...')}
          ${picocolors.green('+ a11yAddonAnnotations,')}
          ${picocolors.gray(']);')}

          ${picocolors.gray('beforeAll(annotations.beforeAll);')}
        `);
      } else {
        const fileExtensionSetupFile = path.extname(setupFile!);

        prompt.push(
          dedent`${counter++}) We have to update your ${picocolors.cyan(`.storybook/vitest.setup${fileExtensionSetupFile}`)} file to set up project annotations from ${picocolors.magenta(`@storybook/addon-a11y`)}.`
        );
      }
    }

    if (!skipPreviewTransformation) {
      if (transformedPreviewCode === null) {
        prompt.push(dedent`
          ${counter++}) We couldn't find or automatically update your ${picocolors.cyan(`.storybook/preview.<ts|js>`)} in your project to smoothly set up ${picocolors.yellow(`parameters.a11y.test`)} from ${picocolors.magenta(`@storybook/addon-a11y`)}. 
          Please manually update your ${picocolors.cyan(`.storybook/preview.<ts|js>`)} file to include the following:

          ${picocolors.gray('export default {')}
          ${picocolors.gray('  ...')}
          ${picocolors.gray('  parameters: {')}
          ${picocolors.green('+   a11y: {')}
          ${picocolors.gray('+      test: "todo"')}
          ${picocolors.green('+   }')}
          ${picocolors.gray('  }')}
          ${picocolors.gray('}')}
        `);
      } else {
        const fileExtensionPreviewFile = path.extname(previewFile!);

        prompt.push(
          dedent`
            ${counter++}) We have to update your ${picocolors.cyan(`.storybook/preview${fileExtensionPreviewFile}`)} file to set up ${picocolors.yellow('parameters.a11y.test')} from ${picocolors.magenta(`@storybook/addon-a11y`)}.
          `
        );
      }
    }

    if (transformedPreviewCode === null || transformedSetupCode === null) {
      prompt.push(dedent`
        For more information, please refer to the accessibility addon documentation: 
        ${picocolors.cyan('https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration')}
      `);
    }

    return prompt.join('\n\n');
  },

  async run({ result }) {
    const { setupFile, transformedSetupCode, transformedPreviewCode, previewFile } = result;

    if (transformedSetupCode && setupFile) {
      writeFileSync(setupFile, transformedSetupCode, 'utf8');
    }

    if (transformedPreviewCode && previewFile) {
      writeFileSync(previewFile, transformedPreviewCode, 'utf8');
    }
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

export function transformPreviewFile(source: string, filePath: string) {
  if (!shouldPreviewFileBeTransformed(source)) {
    return source;
  }

  const previewConfig = loadConfig(source).parse();

  previewConfig.setFieldValue(['parameters', 'a11y', 'test'], 'todo');

  const formattedPreviewConfig = formatConfig(previewConfig);
  const lines = formattedPreviewConfig.split('\n');

  // Find the line with the "parameters.a11y.test" property
  const parametersLineIndex = lines.findIndex(
    (line) => line.includes('test: "todo"') || line.includes("test: 'todo'")
  );
  if (parametersLineIndex === -1) {
    return formattedPreviewConfig;
  }

  // Determine the indentation level of the "tags" property
  const parametersLine = lines[parametersLineIndex];
  const indentation = parametersLine?.match(/^\s*/)?.[0];

  // Add the comment with the same indentation level
  const comment = `${indentation}// 'todo' - show a11y violations in the test UI only\n${indentation}// 'error' - fail CI on a11y violations\n${indentation}// 'off' - skip a11y checks entirely`;
  lines.splice(parametersLineIndex, 0, comment);

  return formatFileContent(filePath, lines.join('\n'));
}

export function shouldPreviewFileBeTransformed(source: string) {
  const previewConfig = loadConfig(source).parse();
  const parametersA11yTest = previewConfig.getFieldNode(['parameters', 'a11y', 'test']);

  if (parametersA11yTest) {
    return false;
  }

  return true;
}
