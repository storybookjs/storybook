import React from 'react';

import type { Meta } from '@storybook/react-vite';

import { safeMetafileArg } from '../../../scripts/bench/safe-args';

// @ts-expect-error - TS doesn't know about import.meta.glob from Vite
const allMetafiles = import.meta.glob(['../../bench/esbuild-metafiles/**/*.json'], {
  import: 'default',
});

export default {
  title: 'Bench',
  parameters: {
    layout: 'fullscreen',
    chromatic: { disableSnapshot: true },
  },
  args: {
    // default to the storybook/node.json metafile
    metafile: safeMetafileArg(Object.keys(allMetafiles).find((path) => path.includes('/storybook/node.json'))!),
  },
  argTypes: {
    metafile: {
      options: Object.keys(allMetafiles).map(safeMetafileArg).sort(),
      mapping: Object.fromEntries(
        Object.keys(allMetafiles).map((path) => [safeMetafileArg(path), path])
      ),
      control: {
        type: 'select',
        labels: Object.fromEntries(
          Object.keys(allMetafiles).map((path) => {
            const [, dirName, subEntry] = /esbuild-metafiles\/(.+)\/(.+).json/.exec(path)!;
            return [safeMetafileArg(path), `${dirName} - ${subEntry}`];
          })
        ),
      },
    },
  },
  beforeEach: async ({ args }) => {
    if (!args.metafile) {
      globalThis.metafile = undefined;
      return;
    }
    const metafile = await allMetafiles[args.metafile]();
    // this is read by the bundle-analyzer iframe via parent.metafile, in bundle-analyzer/index.js
    globalThis.metafile = JSON.stringify(metafile);
  },
  render: (args) => {
    return (
      <iframe
        src="/bundle-analyzer/index.html"
        style={{ border: 'none', width: '100%', height: '100vh' }}
        key={args.metafile} // force re-render on args change
      />
    );
  },
} satisfies Meta;

export const ESBuildAnalyzer = {
  name: 'ESBuild Metafiles',
};
