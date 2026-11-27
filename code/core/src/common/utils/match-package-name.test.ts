import { describe, expect, it } from 'vitest';

import { matchPackageName } from './match-package-name.ts';

const packageNames = ['@storybook/react', '@storybook/react-vite', 'storybook-solidjs-vite'];

describe('matchPackageName', () => {
  it.each([
    ['a package name', '@storybook/react-vite', '@storybook/react-vite'],
    ['a resolved path', '/repo/node_modules/@storybook/react-vite', '@storybook/react-vite'],
    ['a Windows path', 'C:\\repo\\node_modules\\@storybook\\react-vite', '@storybook/react-vite'],
    [
      'a pnpm virtual-store path',
      '/repo/node_modules/.pnpm/@storybook+react-vite@10.0.0',
      '@storybook/react-vite',
    ],
    [
      'an unscoped package path',
      '/repo/node_modules/storybook-solidjs-vite',
      'storybook-solidjs-vite',
    ],
  ])('matches %s', (_, nameOrPath, expected) => {
    expect(matchPackageName(nameOrPath, packageNames)).toBe(expected);
  });

  it('does not match a package whose name only ends with a known name', () => {
    expect(matchPackageName('/repo/node_modules/my-storybook-solidjs-vite', packageNames)).toBe(
      undefined
    );
  });

  it('does not match a pnpm virtual-store path of a longer package name', () => {
    expect(
      matchPackageName('/repo/node_modules/.pnpm/@storybook+react-native@10.0.0', packageNames)
    ).toBeUndefined();
  });
});
