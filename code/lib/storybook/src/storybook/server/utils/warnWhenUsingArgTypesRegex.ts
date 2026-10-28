import { readFile } from 'node:fs/promises';

import type { StorybookConfig } from '@storybook/core/internal/types';

import picocolors from 'picocolors';
import { dedent } from '@storybook/core/internal/deep/utils/node-libs';

import { codeFrame, parseModule, walk } from '@storybook/core/internal/deep/csf-tools/estree/ast';

export async function warnWhenUsingArgTypesRegex(
  previewConfigPath: string | undefined,
  config: StorybookConfig
) {
  const previewContent = previewConfigPath
    ? await readFile(previewConfigPath, { encoding: 'utf8' })
    : '';

  const hasVisualTestAddon =
    config?.addons?.some((it) =>
      typeof it === 'string'
        ? it === '@chromatic-com/storybook'
        : it.name === '@chromatic-com/storybook'
    ) ?? false;

  if (hasVisualTestAddon && previewConfigPath && previewContent.includes('argTypesRegex')) {
    const { program, code } = parseModule(previewContent, previewConfigPath);
    walk(program, (node) => {
      if (node.type === 'Identifier' && node.name === 'argTypesRegex') {
        const message = dedent`
          ${picocolors.bold('Attention')}: We've detected that you're using ${picocolors.cyan(
            'actions.argTypesRegex'
          )} together with the visual test addon:
          
          ${codeFrame(previewConfigPath, code, node.start)}
          
          We recommend removing the ${picocolors.cyan(
            'argTypesRegex'
          )} and assigning explicit action with the ${picocolors.cyan(
            'fn'
          )} function from ${picocolors.cyan('storybook/test')} instead:
          https://storybook.js.org/docs/essentials/actions#via-storybooktest-fn-spies
          
          The build used by the addon for snapshot testing doesn't take the regex into account, which can cause hard to debug problems when a snapshot depends on the presence of action props.
        `;
        console.warn(message);
      }
    });
  }
}
