import { readFile } from 'node:fs/promises';

import { getAddonNames } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import { shortenPath } from '../util.ts';
import { createBlocker } from './types.ts';

const removedVisionGlobal = /\bvision['"]?\s*:\s*['"`](?:protanomaly|deuteranomaly)['"`]/;
const maxListedFiles = 10;

export const blocker = createBlocker({
  id: 'a11yRemovedVisionSimulations',
  async check({ mainConfig, previewConfigPath, storiesPaths }) {
    if (!getAddonNames(mainConfig).includes('@storybook/addon-a11y')) {
      return false;
    }

    const files: string[] = [];
    for (const file of previewConfigPath ? [previewConfigPath, ...storiesPaths] : storiesPaths) {
      const code = await readFile(file, 'utf8').catch(() => '');
      if (removedVisionGlobal.test(code)) {
        files.push(file);
      }
    }

    return files.length > 0 && { files };
  },
  log({ files }) {
    const listed = files.slice(0, maxListedFiles).map((file) => `- ${shortenPath(file)}`);
    if (files.length > maxListedFiles) {
      listed.push(`- and ${files.length - maxListedFiles} more`);
    }

    return {
      title: 'Vision simulations removed from the accessibility addon',
      message: dedent`
        The Vision Simulator no longer offers the \`protanomaly\` and \`deuteranomaly\` simulations.
        These files still set one of them through the \`vision\` global:

        ${listed.join('\n')}

        Remove the global, or replace it with \`protanopia\` or \`deuteranopia\`, which simulate the most
        severe form of each condition.

        This is a manual migration. Storybook cannot choose for you, because the replacement renders
        differently and changes the visual snapshots of these stories.
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#addon-a11y-removed-protanomaly-and-deuteranomaly-vision-simulations',
    };
  },
});
