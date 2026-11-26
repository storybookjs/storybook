import { expect, it, vi } from 'vitest';

import { deprecate } from 'storybook/internal/client-logger';

import { globalsNameValueMap } from './runtime.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

it('warns that @storybook/global is deprecated when preview code reads its export', () => {
  vi.mocked(deprecate).mockImplementation(() => {});
  expect(deprecate).not.toHaveBeenCalled();

  expect(globalsNameValueMap['@storybook/global'].global).toBe(globalThis);

  expect(deprecate).toHaveBeenCalledWith(expect.stringContaining('`@storybook/global`'));
});
