import { describe, expect, it, vi } from 'vitest';

import {
  STORYBOOK_VERSION_SPECIFIER_ENV,
  resolveStorybookVersionSpecifier,
} from './resolve-storybook-version-specifier.ts';

describe('resolveStorybookVersionSpecifier', () => {
  it('prefers the dispatcher env var and skips the ancestry lookup', () => {
    const getAncestry = vi.fn(() => [
      {
        command:
          'npx storybook@https://pkg.pr.new/storybookjs/storybook/storybook@from-ancestry upgrade',
      },
    ]);

    expect(
      resolveStorybookVersionSpecifier(
        {
          [STORYBOOK_VERSION_SPECIFIER_ENV]:
            'https://pkg.pr.new/storybookjs/storybook/storybook@from-env',
        },
        getAncestry
      )
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@from-env');
    expect(getAncestry).not.toHaveBeenCalled();
  });

  it('reads a pkg.pr.new URL from ancestry when the env var is unset', () => {
    expect(
      resolveStorybookVersionSpecifier({}, () => [
        {
          command:
            'npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef upgrade',
        },
      ])
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef');
  });

  it('returns undefined when neither env nor ancestry has a specifier', () => {
    expect(resolveStorybookVersionSpecifier({}, () => [])).toBeUndefined();
  });
});
