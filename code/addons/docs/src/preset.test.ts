import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { viteFinal } from './preset.ts';

const aliasesFor = async (react: Record<string, string>) => {
  const presets = {
    apply: async (name: string, value: unknown) => (name === 'resolvedReact' ? react : value),
  };
  const config = await viteFinal({}, { presets, csfPluginOptions: null } as unknown as Options);
  const deduplication = config.plugins.find(
    (plugin: { name: string }) => plugin.name === 'storybook:package-deduplication'
  );
  return deduplication.config().resolve.alias;
};

describe('viteFinal', () => {
  it('aliases React to the directories resolvedReact gives', async () => {
    expect(
      await aliasesFor({
        react: '/project/node_modules/react',
        reactDom: '/project/node_modules/react-dom',
        mdx: '/project/node_modules/@mdx-js/react/index.js',
      })
    ).toEqual({
      react: '/project/node_modules/react',
      'react-dom': '/project/node_modules/react-dom',
      'react-dom/server': '/project/node_modules/react-dom/server.browser.js',
      '@mdx-js/react': '/project/node_modules/@mdx-js/react/index.js',
    });
  });

  it('does not alias a package to its own name', async () => {
    expect(
      await aliasesFor({ react: 'react', reactDom: 'react-dom', mdx: '@mdx-js/react' })
    ).toEqual({});
  });

  it('aliases React to another package resolvedReact gives', async () => {
    expect(
      await aliasesFor({
        react: 'preact/compat',
        reactDom: 'preact/compat',
        mdx: '/project/node_modules/@mdx-js/react/index.js',
      })
    ).toEqual({
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      '@mdx-js/react': '/project/node_modules/@mdx-js/react/index.js',
    });
  });
});
