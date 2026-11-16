import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTypeScriptForDocgenError } from 'storybook/internal/common';

import { getDocgenPackageMissingError } from './loadReactDocgen.ts';

vi.mock('storybook/internal/common', { spy: true });

describe('getDocgenPackageMissingError', () => {
  beforeEach(() => {
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(undefined);
  });

  it('checks typescript for react-docgen against the APIs the docgen server runs on', () => {
    getDocgenPackageMissingError('react-docgen');

    expect(getTypeScriptForDocgenError).toHaveBeenCalledWith(expect.any(Function), {
      apis: ['compiler', 'native'],
    });
  });

  it('checks typescript for react-docgen-typescript against the compiler API, which it needs', () => {
    getDocgenPackageMissingError('react-docgen-typescript');

    expect(getTypeScriptForDocgenError).toHaveBeenCalledWith(expect.any(Function), {
      apis: ['compiler'],
    });
  });

  it('names the missing package when typescript is usable', () => {
    expect(getDocgenPackageMissingError('react-docgen')).toEqual({
      name: 'react-docgen is not installed',
      message: expect.stringContaining('Builder docgen needs the `react-docgen` package'),
    });
  });
});
