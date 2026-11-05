import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const {
  hooks: { readPackage },
} = createRequire(import.meta.url)('./workspace-peers.pnpmfile.cjs');

describe('workspace-peers pnpmfile', () => {
  it('rewrites workspace: peer ranges the way publishing does', () => {
    const pkg = readPackage({
      name: '@storybook/react',
      version: '11.0.0-beta.0',
      peerDependencies: {
        storybook: 'workspace:^',
        '@storybook/test': 'workspace:*',
        '@storybook/global': 'workspace:~',
        '@storybook/other': 'workspace:^11.0.0',
        react: '^18 || ^19',
      },
    });

    expect(pkg.peerDependencies).toEqual({
      storybook: '^11.0.0-beta.0',
      '@storybook/test': '11.0.0-beta.0',
      '@storybook/global': '~11.0.0-beta.0',
      '@storybook/other': '^11.0.0',
      react: '^18 || ^19',
    });
  });

  it('leaves workspace: dependencies for the overrides, so a missing one fails loudly', () => {
    const pkg = readPackage({
      name: '@storybook/react-vite',
      version: '11.0.0-beta.0',
      dependencies: { '@storybook/builder-vite': 'workspace:*' },
    });

    expect(pkg.dependencies['@storybook/builder-vite']).toBe('workspace:*');
  });
});
