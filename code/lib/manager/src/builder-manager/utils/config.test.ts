import { expect, it, vi } from 'vitest';

import { build, type Plugin } from 'esbuild';

import { getManagerConfig } from './config.ts';

vi.mock('./managerEntries.ts', () => ({
  wrapManagerEntries: async (entries: string[]) => entries,
}));

const SOURCES: Record<string, string> = {
  'docgen.js': `import { request } from './client.js'; request('docgen');`,
  'review.js': `import { request } from './client.js'; request('review');`,
  'measure.js': `import { addons } from 'storybook/manager-api'; addons.register('measure', () => {});`,
  'client.js': `import { addons } from 'storybook/manager-api'; export const request = (id) => addons.getChannel().emit(id);`,
};

const virtualSources: Plugin = {
  name: 'virtual-sources',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /\.js$/ }, ({ path }) => ({
      path: path.replace('./', ''),
      namespace: 'virtual',
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'virtual' }, ({ path }) => ({
      contents: SOURCES[path],
      loader: 'js',
    }));
  },
};

it('builds every manager entry together so shared modules are emitted once', async () => {
  const config = await getManagerConfig(
    { configDir: '/project/.storybook', outputDir: '/project/out' },
    ['docgen.js', 'review.js', 'measure.js'],
    {}
  );
  const result = await build({
    ...config,
    plugins: [...(config.plugins ?? []), virtualSources],
    legalComments: 'none',
  });
  const outputs = Object.entries(result.metafile!.outputs);

  const outputsByInput = new Map<string, string[]>();
  for (const [output, { inputs }] of outputs) {
    for (const [input, { bytesInOutput }] of Object.entries(inputs)) {
      if (bytesInOutput > 0) {
        outputsByInput.set(input, [...(outputsByInput.get(input) ?? []), output]);
      }
    }
  }
  const duplicated = [...outputsByInput].filter(([, files]) => files.length > 1);

  expect(duplicated).toEqual([]);
  expect(
    outputs.map(([output, { entryPoint }]) =>
      entryPoint ? `${entryPoint} -> ${output.split('/').pop()}` : 'chunk'
    )
  ).toMatchInlineSnapshot(`
    [
      "virtual:docgen.js -> docgen.js",
      "virtual:review.js -> review.js",
      "chunk",
      "virtual:measure.js -> measure.js",
      "chunk",
    ]
  `);
});
