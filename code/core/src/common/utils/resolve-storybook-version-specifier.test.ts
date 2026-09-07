import { describe, expect, it } from 'vitest';

import {
  STORYBOOK_VERSION_SPECIFIER_ENV,
  resolveStorybookVersionSpecifier,
} from './resolve-storybook-version-specifier.ts';

describe('resolveStorybookVersionSpecifier', () => {
  it('prefers the dispatcher env var over process ancestry', () => {
    expect(
      resolveStorybookVersionSpecifier(
        [
          {
            command:
              'npx storybook@https://pkg.pr.new/storybookjs/storybook/storybook@from-ancestry upgrade',
          },
        ],
        {
          [STORYBOOK_VERSION_SPECIFIER_ENV]:
            'https://pkg.pr.new/storybookjs/storybook/storybook@from-env',
        }
      )
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@from-env');
  });

  it('reads a pkg.pr.new URL from ancestry when the env var is unset', () => {
    expect(
      resolveStorybookVersionSpecifier(
        [
          {
            command:
              'npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef upgrade',
          },
        ],
        {}
      )
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef');
  });

  it('returns undefined when neither env nor ancestry has a specifier', () => {
    expect(resolveStorybookVersionSpecifier([], {})).toBeUndefined();
  });
});
