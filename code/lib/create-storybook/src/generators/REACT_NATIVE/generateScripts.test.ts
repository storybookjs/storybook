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

  it('does not double-prefix when the base script already sets STORYBOOK_ENABLED=true', () => {
    const result = deriveStorybookPlatformScripts({
      ios: 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
      android: 'STORYBOOK_ENABLED=true react-native run-android',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
      'storybook:android': 'STORYBOOK_ENABLED=true react-native run-android',
    });
    expect(result.missingBaseScripts).toEqual([]);
  });

  it('respects an explicit STORYBOOK_ENABLED=false in the base script and does not override it', () => {
    const result = deriveStorybookPlatformScripts({
      ios: 'cross-env STORYBOOK_ENABLED=false react-native run-ios',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=false react-native run-ios',
    });
  });

  it('injects STORYBOOK_ENABLED into an existing cross-env prefix instead of nesting cross-env', () => {
    const result = deriveStorybookPlatformScripts({
      ios: 'cross-env FOO=bar react-native run-ios',
      android: 'cross-env FOO=bar BAZ=qux react-native run-android',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true FOO=bar react-native run-ios',
      'storybook:android':
        'cross-env STORYBOOK_ENABLED=true FOO=bar BAZ=qux react-native run-android',
    });
  });

  it('injects STORYBOOK_ENABLED into an existing cross-env-shell prefix', () => {
    const result = deriveStorybookPlatformScripts({
      ios: 'cross-env-shell FOO=bar "react-native run-ios && echo done"',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios':
        'cross-env-shell STORYBOOK_ENABLED=true FOO=bar "react-native run-ios && echo done"',
    });
  });

  it('trims surrounding whitespace before applying the prefix', () => {
    const result = deriveStorybookPlatformScripts({
      ios: '   react-native run-ios   ',
    });

    expect(result.scriptsToAdd).toEqual({
      'storybook:ios': 'cross-env STORYBOOK_ENABLED=true react-native run-ios',
    });
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
