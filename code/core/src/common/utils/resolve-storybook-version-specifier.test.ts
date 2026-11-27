import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProcessAncestry } from './process-ancestry.ts';
import {
  STORYBOOK_VERSION_SPECIFIER_ENV,
  resolveStorybookVersionSpecifier,
} from './resolve-storybook-version-specifier.ts';

describe('resolveStorybookVersionSpecifier', () => {
  beforeEach(() => {
    vi.mocked(getProcessAncestry).mockClear();
  });

  it('prefers the dispatcher env var and skips the ancestry lookup', () => {
    expect(
      resolveStorybookVersionSpecifier({
        [STORYBOOK_VERSION_SPECIFIER_ENV]:
          'https://pkg.pr.new/storybookjs/storybook/storybook@from-env',
      })
    ).toBe('https://pkg.pr.new/storybookjs/storybook/storybook@from-env');
    expect(getProcessAncestry).not.toHaveBeenCalled();
  });

  it('reads a pkg.pr.new URL from ancestry when the env var is unset', () => {
    vi.mocked(getProcessAncestry).mockReturnValueOnce([
      {
        pid: 2,
        ppid: 1,
        command:
          'npx --yes --allow-remote=all https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef upgrade',
      },
    ]);

    expect(resolveStorybookVersionSpecifier({})).toBe(
      'https://pkg.pr.new/storybookjs/storybook/storybook@deadbeef'
    );
  });

  it('returns undefined when neither env nor ancestry has a specifier', () => {
    expect(resolveStorybookVersionSpecifier({})).toBeUndefined();
  });
});
