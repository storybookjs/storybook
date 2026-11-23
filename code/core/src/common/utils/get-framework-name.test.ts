import { describe, expect, it } from 'vitest';

import { extractFrameworkPackageName, getFrameworkPackageName } from './get-framework-name.ts';

describe('get-framework-name', () => {
  describe('extractProperFrameworkName', () => {
    it('should extract the proper framework name from the given framework field', () => {
      expect(extractFrameworkPackageName('@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('/path/to/@storybook/angular')).toBe('@storybook/angular');
      expect(extractFrameworkPackageName('\\path\\to\\@storybook\\angular')).toBe(
        '@storybook/angular'
      );
    });

    it('should extract the proper framework name from pnpm virtual-store paths', () => {
      // pnpm resolves getAbsolutePath('@storybook/react-vite') to a path inside .pnpm
      expect(
        extractFrameworkPackageName(
          '/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0/node_modules/@storybook/react-vite'
        )
      ).toBe('@storybook/react-vite');
      // ...or to the virtual-store dir itself, which does not end with the package name
      expect(
        extractFrameworkPackageName('/repo/node_modules/.pnpm/@storybook+react-vite@9.0.0')
      ).toBe('@storybook/react-vite');
    });

    it('should return the given framework name if it is a third-party framework', () => {
      expect(extractFrameworkPackageName('@third-party/framework')).toBe('@third-party/framework');
    });
  });
});

describe('getFrameworkPackageName', () => {
  it('returns null without a main config', () => {
    expect(getFrameworkPackageName(undefined)).toBeNull();
  });

  it('prefers the framework field over the React Native config folder', () => {
    expect(
      getFrameworkPackageName(
        { stories: [], framework: '@storybook/react-native-web-vite' },
        '/project/.rnstorybook'
      )
    ).toBe('@storybook/react-native-web-vite');
  });

  it('infers React Native for a .rnstorybook config without a framework', () => {
    expect(getFrameworkPackageName({ stories: [] }, '/project/.rnstorybook')).toBe(
      '@storybook/react-native'
    );
  });

  it('returns null for a .storybook config without a framework', () => {
    expect(getFrameworkPackageName({ stories: [] }, '/project/.storybook')).toBeNull();
  });
});
