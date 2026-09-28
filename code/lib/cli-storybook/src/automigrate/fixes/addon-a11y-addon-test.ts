import { formatFileContent, frameworkPackages, getAddonNames } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

// Relative path import to avoid dependency to storybook/test
import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

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
  previewFile: string | null;
  transformedPreviewCode: string | null;
}

/**
 * If addon-a11y and addon-vitest are both installed, sets `parameters.a11y.test` in
 * `.storybook/preview.<ts|js>`, or prompts the user to do it when the file can't be transformed.
 */
export const addonA11yAddonTest: Fix<AddonA11yAddonTestOptions> = {
  id: 'addon-a11y-addon-test',
  link: 'https://storybook.js.org/docs/writing-tests/accessibility-testing#with-the-vitest-addon',

  promptType: 'auto',

  async check({ mainConfig, configDir }) {
    const addons = getAddonNames(mainConfig);

    const frameworkPackageName = getFrameworkPackageName(mainConfig);

    const hasA11yAddon = !!addons.find((addon) => addon.includes('@storybook/addon-a11y'));
    const hasTestAddon = !!addons.find((addon) => addon.includes('@storybook/addon-vitest'));

    if (
      !Object.keys(frameworkPackages).find((framework) => frameworkPackageName?.includes(framework))
    ) {
      return null;
    }

    if (!hasA11yAddon || !hasTestAddon || !configDir) {
      return null;
    }

    const previewFile =
      fileExtensions
        .map((ext) => path.join(configDir, `preview${ext}`))
        .find((filePath) => existsSync(filePath)) ?? null;

    let transformedPreviewCode: string | null = null;
    if (previewFile) {
      try {
        const previewSource = readFileSync(previewFile, 'utf8');
        if (!shouldPreviewFileBeTransformed(previewSource)) {
          return null;
        }
        transformedPreviewCode = await transformPreviewFile(previewSource, previewFile);
      } catch {
        // an unreadable or unparsable preview file is reported as a manual step by `run`
      }
    }

    return { previewFile, transformedPreviewCode };
  },

  prompt() {
    return 'We have detected that you have @storybook/addon-a11y and @storybook/addon-vitest installed. The automigration will configure both for the new testing experience';
  },

  async run({ result }) {
    const { previewFile, transformedPreviewCode } = result;

    if (!previewFile || transformedPreviewCode === null) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(dedent`
        The ${this.id} automigration couldn't make the changes but here are instructions for doing them yourself:
        We couldn't find or automatically update your .storybook/preview.<ts|js> in your project to smoothly set up ${picocolors.cyan('parameters.a11y.test')} from @storybook/addon-a11y. Please manually update your .storybook/preview.<ts|js> file to include the following:

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

    writeFileSync(previewFile, transformedPreviewCode, 'utf8');
  },
};

export function transformPreviewFile(source: string, filePath: string) {
  if (!shouldPreviewFileBeTransformed(source)) {
    return source;
  }

  const previewConfig = loadConfig(source).parse();

  previewConfig.set(['parameters', 'a11y', 'test'], 'todo');
  assertConfigMutationSuccess(previewConfig);

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
  const parametersA11yTest = previewConfig.get(['parameters', 'a11y', 'test']);
  assertConfigMutationSuccess(previewConfig);

  if (parametersA11yTest) {
    return false;
  }

  return true;
}
