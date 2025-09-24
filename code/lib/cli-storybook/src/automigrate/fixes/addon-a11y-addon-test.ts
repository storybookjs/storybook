import { formatFileContent, getAddonNames } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import jscodeshift from 'jscodeshift';
import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

// Relative path import to avoid dependency to storybook/test
import { SUPPORTED_FRAMEWORKS } from '../../../../../addons/vitest/src/constants';
import { getFrameworkPackageName } from '../helpers/mainConfigFile';
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
 * If addon-a11y and addon-vitest are already installed, we need to update
 *
 * - `.storybook/vitest.setup.<ts|js>` to set up project annotations from addon-a11y.
 * - `.storybook/preview.<ts|js>` to set up tags.
 * - If we can't transform the files automatically, we'll prompt the user to do it manually.
 */
export const addonA11yAddonTest: Fix<AddonA11yAddonTestOptions> = {
  id: 'addon-a11y-addon-test',
  link: 'https://storybook.js.org/docs/writing-tests/accessibility-testing#test-addon-integration',

  promptType: 'auto',

  async check({ mainConfig, configDir }) {
    const addons = getAddonNames(mainConfig);

    const frameworkPackageName = getFrameworkPackageName(mainConfig);

    const hasA11yAddon = !!addons.find((addon) => addon.includes('@storybook/addon-a11y'));
    const hasTestAddon = !!addons.find((addon) => addon.includes('@storybook/addon-vitest'));

    if (!SUPPORTED_FRAMEWORKS.find((framework) => frameworkPackageName?.includes(framework))) {
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

  prompt() {
    return 'We have detected that you have @storybook/addon-a11y and @storybook/addon-vitest installed. The automigration will configure both for the new testing experience in Storybook 9';
  },

  async run({ result }) {
    let counter = 1;

    const {
      transformedSetupCode,
      skipPreviewTransformation,
      skipVitestSetupTransformation,
      setupFile,
      previewFile,
      transformedPreviewCode,
    } = result;

    const errorMessage: string[] = [];
    if (!skipVitestSetupTransformation) {
      if (transformedSetupCode === null) {
        errorMessage.push(dedent`
          ${counter++}) We couldn't find or automatically update ${picocolors.cyan(`.storybook/vitest.setup.<ts|js>`)} in your project to smoothly set up project annotations from ${picocolors.magenta(`@storybook/addon-a11y`)}. 
          Please manually update your ${picocolors.cyan(`vitest.setup.ts`)} file to include the following:

          ${picocolors.gray('...')}   
          ${picocolors.green('+ import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";')}

          ${picocolors.gray('setProjectAnnotations([')}
          ${picocolors.gray('  ...')}
          ${picocolors.green('+ a11yAddonAnnotations,')}
          ${picocolors.gray(']);')}
        `);
      }
    }

    if (!skipPreviewTransformation) {
      if (transformedPreviewCode === null) {
        errorMessage.push(dedent`
          ${counter++}) We couldn't find or automatically update your .storybook/preview.<ts|js> in your project to smoothly set up ${picocolors.cyan('parameters.a11y.test')} from @storybook/addon-a11y. Please manually update your .storybook/preview.<ts|js> file to include the following:

          ${picocolors.gray('export default {')}
          ${picocolors.gray('  ...')}
          ${picocolors.gray('  parameters: {')}
          ${picocolors.green('+   a11y: {')}
          ${picocolors.gray('+      test: "todo"')}
          ${picocolors.green('+   }')}
          ${picocolors.gray('  }')}
          ${picocolors.gray('}')}
        `);
      }
    }

    if (errorMessage.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        dedent`The ${this.id} automigration couldn't make the changes but here are instructions for doing them yourself:\n${errorMessage.join('\n')}`
      );
    }

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
