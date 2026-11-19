import { readFile } from 'node:fs/promises';

import { getAddonNames } from 'storybook/internal/common';
import { loadConfig, loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { shortenPath } from '../util.ts';
import { createBlocker } from './types.ts';

const removedSimulations = ['protanomaly', 'deuteranomaly', 'tritanomaly'];
const mentionsRemovedSimulation = new RegExp(removedSimulations.join('|'));
const maxListedFiles = 10;
const maxConcurrentReads = 10;

const setsRemovedSimulation = async (file: string, kind: 'preview' | 'story') => {
  const code = await readFile(file, 'utf8');
  if (!mentionsRemovedSimulation.test(code)) {
    return false;
  }

  const objects =
    kind === 'preview'
      ? [loadConfig(code, file).parse()]
      : loadCsf(code, { fileName: file, makeTitle: (title) => title || file })
          .parse()
          .objects();
  const globals = kind === 'preview' ? 'initialGlobals' : 'globals';

  return objects.some((object) => {
    const vision = object.getValue([globals, 'vision']);
    return typeof vision === 'string' && removedSimulations.includes(vision);
  });
};

export const blocker = createBlocker({
  id: 'a11yRemovedVisionSimulations',
  async check({ mainConfig, previewConfigPath, storiesPaths }) {
    if (!getAddonNames(mainConfig).includes('@storybook/addon-a11y')) {
      return false;
    }

    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(maxConcurrentReads);
    const candidates = [
      ...(previewConfigPath ? [{ file: previewConfigPath, kind: 'preview' as const }] : []),
      ...storiesPaths.map((file) => ({ file, kind: 'story' as const })),
    ];
    // A file that cannot be read or parsed is left to the runtime warning of the addon.
    const matches = await Promise.all(
      candidates.map(({ file, kind }) =>
        limit(() => setsRemovedSimulation(file, kind).catch(() => false))
      )
    );
    const files = candidates.filter((_, index) => matches[index]).map(({ file }) => file);

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
        The Vision Simulator no longer offers the \`protanomaly\`, \`deuteranomaly\` and \`tritanomaly\`
        simulations. These files still set one of them through the \`vision\` global:

        ${listed.join('\n')}

        Remove the global, or replace it with \`protanopia\`, \`deuteranopia\` or \`tritanopia\`, which
        simulate the most severe form of each condition.

        This is a manual migration. Storybook cannot choose for you, because the replacement renders
        differently and changes the visual snapshots of these stories.
      `,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#addon-a11y-removed-anomaly-vision-simulations',
    };
  },
});
