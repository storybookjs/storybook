import type { PackageJson, StorybookConfig } from '@storybook/core/types';
import { getConfigInfo } from '@storybook/core/common';
import { readFile } from 'fs-extra';
import { dedent } from 'ts-dedent';
import chalk from 'chalk';
import { babelParseFile } from '@storybook/core/csf-tools';

export async function warnWhenUsingArgTypesRegex(
  packageJson: PackageJson,
  configDir: string,
  config: StorybookConfig
) {
  const { previewConfig } = getConfigInfo(packageJson, configDir);
  const previewContent = previewConfig ? await readFile(previewConfig, 'utf8') : '';

  const hasVisualTestAddon =
    config?.addons?.some((it) =>
      typeof it === 'string'
        ? it === '@chromatic-com/storybook'
        : it.name === '@chromatic-com/storybook'
    ) ?? false;

  if (hasVisualTestAddon && previewConfig && previewContent.includes('argTypesRegex')) {
    const file = babelParseFile(previewContent, previewConfig);

    file.path.traverse({
      Identifier: (path) => {
        if (path.node.name === 'argTypesRegex') {
          const message = dedent`
            ${chalk.bold('Attention')}: We've detected that you're using ${chalk.cyan(
              'actions.argTypesRegex'
            )} together with the visual test addon:
            
            ${path.buildCodeFrameError(previewConfig).message}
            
            We recommend removing the ${chalk.cyan(
              'argTypesRegex'
            )} and assigning explicit action with the ${chalk.cyan(
              'fn'
            )} function from ${chalk.cyan('@storybook/test')} instead:
            https://storybook.js.org/docs/essentials/actions#via-storybooktest-fn-spy-function
            
            The build used by the addon for snapshot testing doesn't take the regex into account, which can cause hard to debug problems when a snapshot depends on the presence of action props.
          `;
          console.warn(message);
        }
      },
    });
  }
}
