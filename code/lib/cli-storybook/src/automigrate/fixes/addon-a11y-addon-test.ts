import { formatFileContent, frameworkPackages, getAddonNames } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import { existsSync } from 'fs';
import path from 'path';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

const PREVIEW_EXTENSIONS = ['.js', '.ts', '.cts', '.mts', '.cjs', '.mjs', '.jsx', '.tsx'];

// `previewFile` is null when there is no preview file or it cannot be transformed.
export const addonA11yAddonTest: Fix<{ previewFile: string | null }> = {
  id: 'addon-a11y-addon-test',
  link: 'https://storybook.js.org/docs/writing-tests/accessibility-testing#with-the-vitest-addon',

  promptType: 'auto',

  async check({ mainConfig, configDir, files }) {
    const addons = getAddonNames(mainConfig);
    const frameworkPackageName = getFrameworkPackageName(mainConfig);

    if (
      !Object.keys(frameworkPackages).some((framework) =>
        frameworkPackageName?.includes(framework)
      ) ||
      !addons.some((addon) => addon.includes('@storybook/addon-a11y')) ||
      !addons.some((addon) => addon.includes('@storybook/addon-vitest')) ||
      !configDir
    ) {
      return null;
    }

    const previewFile = PREVIEW_EXTENSIONS.map((ext) => path.join(configDir, `preview${ext}`)).find(
      (filePath) => existsSync(filePath)
    );
    if (!previewFile) {
      return { previewFile: null };
    }

    try {
      const changed = await files.edit(previewFile, transformPreviewFile);
      return changed.length > 0 ? { previewFile } : null;
    } catch {
      return { previewFile: null };
    }
  },

  prompt() {
    return 'We have detected that you have @storybook/addon-a11y and @storybook/addon-vitest installed. The automigration will configure both for the new testing experience';
  },

  async run({ result: { previewFile }, files }) {
    if (!previewFile) {
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

    await files.edit(previewFile, transformPreviewFile);
  },
};

export async function transformPreviewFile(source: string, filePath: string) {
  const previewConfig = loadConfig(source).parse();
  if (previewConfig.get(['parameters', 'a11y', 'test'])) {
    return source;
  }

  previewConfig.set(['parameters', 'a11y', 'test'], 'todo');
  assertConfigMutationSuccess(previewConfig);

  const withComment = formatConfig(previewConfig).replace(
    /^([ \t]*).*test: (?:"todo"|'todo')/m,
    (line, indent) =>
      `${indent}// 'todo' - show a11y violations in the test UI only\n${indent}// 'error' - fail CI on a11y violations\n${indent}// 'off' - skip a11y checks entirely\n${line}`
  );

  return formatFileContent(filePath, withComment);
}
