import { describe, expect, it } from 'vitest';

import { hasAddonVitest } from './addon-vitest.ts';

describe('hasAddonVitest', () => {
  it('reads the addons of the main config, by name or by path', () => {
    expect(hasAddonVitest({ addons: ['@storybook/addon-vitest'] } as never)).toBe(true);
    expect(
      hasAddonVitest({
        addons: [{ name: '/repo/node_modules/@storybook/addon-vitest/preset' }],
      } as never)
    ).toBe(true);
    expect(hasAddonVitest({ addons: ['@storybook/addon-docs'] } as never)).toBe(false);
    expect(hasAddonVitest({} as never)).toBe(false);
  });
});
