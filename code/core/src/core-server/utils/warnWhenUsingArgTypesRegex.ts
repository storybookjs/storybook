import { readFile } from 'node:fs/promises';

import type { StorybookConfig } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { locationOf, parseModule, walk } from '../../csf-tools/estree/ast.ts';

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
    const { program } = parseModule(previewContent, previewConfigPath);
    walk(program, (node) => {
      if (node.type === 'Identifier' && node.name === 'argTypesRegex') {
        const message = dedent`
          ${picocolors.bold('Attention')}: We've detected that you're using ${picocolors.cyan(
            'actions.argTypesRegex'
          )} together with the visual test addon:
          
          ${codeFrame(previewConfigPath, previewContent, node.start)}
          
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

// `file (line:column)` and the offending line with a marker under the identifier.
const codeFrame = (fileName: string, code: string, index: number) => {
  const { line, column } = locationOf(code, index, index).start;
  const text = code.split('\n')[line - 1] ?? '';
  return `${fileName}: (${line}:${column})\n> ${line} | ${text}\n  ${' '.repeat(String(line).length)} | ${' '.repeat(column)}^`;
};
