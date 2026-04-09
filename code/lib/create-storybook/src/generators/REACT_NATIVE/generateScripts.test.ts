import { describe, expect, it } from 'vitest';

import { deriveStorybookPlatformScripts } from './generateScripts.ts';

describe('deriveStorybookPlatformScripts', () => {
  it('derives storybook platform scripts from ios and android scripts', () => {
    const inputScripts = {
      ios: 'react-native run-ios',
      android: 'react-native run-android',
      start: 'react-native start',
    };

    const result = deriveStorybookPlatformScripts(inputScripts);

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
      'storybook:android': 'cross-env STORYBOOK_ENABLED=true react-native run-android',
    });
    expect(result.missingBaseScripts).toEqual([]);
  });

  it('reports missing source scripts and only emits available platform scripts', () => {
    const result = deriveStorybookPlatformScripts({
      ios: 'react-native run-ios',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
    });
    expect(result.missingBaseScripts).toEqual(['android']);
  });

  it('does not mutate unrelated scripts', () => {
    const inputScripts = {
      ios: 'react-native run-ios',
      android: 'react-native run-android',
      storybook: 'cross-env STORYBOOK_ENABLED=true react-native start',
      test: 'jest',
      lint: 'eslint .',
      'storybook:web': 'storybook dev -p 6006',
      'build-storybook': 'storybook build',
    };
    const snapshot = { ...inputScripts };

    deriveStorybookPlatformScripts(inputScripts);

    expect(inputScripts).toEqual(snapshot);
  });
});
