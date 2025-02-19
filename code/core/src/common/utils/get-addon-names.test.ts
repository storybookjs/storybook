import { describe, expect, it } from 'vitest';

import { getAddonNames } from './get-addon-names';

describe('getAddonNames', () => {
  it('should extract addon names from simple strings', () => {
    const config = {
      stories: [],
      addons: ['@storybook/addon-actions', '@storybook/addon-outline'],
    };
    const result = getAddonNames(config);
    expect(result).toEqual(['@storybook/addon-actions', '@storybook/addon-outline']);
  });

  it('should extract addon names from object notation', () => {
    const config = {
      stories: [],
      addons: [{ name: '@storybook/addon-actions' }, { name: '@storybook/addon-outline' }],
    };
    const result = getAddonNames(config);
    expect(result).toEqual(['@storybook/addon-actions', '@storybook/addon-outline']);
  });

  it('should filter out relative paths for local addons', () => {
    const config = {
      stories: [],
      addons: ['./local-addon', { name: './another-local-addon' }],
    };
    const result = getAddonNames(config);
    expect(result).toEqual([]);
  });

  it('should extract addon names from absolute paths', () => {
    const config = {
      stories: [],
      addons: [
        '/sandbox/react-vite-default-ts/node_modules/@storybook/addon-actions',
        '/sandbox/react-vite-default-ts/node_modules/@storybook/addon-outline',
      ],
    };
    const result = getAddonNames(config);
    expect(result).toEqual(['@storybook/addon-actions', '@storybook/addon-outline']);
  });

  it('should extract addon names from pnpm paths', () => {
    const config = {
      stories: [],
      addons: [
        '/Users/xxx/node_modules/.pnpm/@storybook+addon-essentials@8.5.0-beta.5_@types+react@18.2.33_storybook@8.5.0-beta.5_prettier@3.2.5_/node_modules/@storybook/addon-essentials',
      ],
    };
    const result = getAddonNames(config);
    expect(result).toEqual(['@storybook/addon-essentials']);
  });

  it('should extract addon names from yarn pnp paths', () => {
    const config = {
      stories: [],
      addons: [
        '/Users/xxx/.yarn/__virtual__/@storybook-addon-essentials-virtual-5c3b9b3005/3/.yarn/berry/cache/@storybook-addon-essentials-npm-8.5.0-bbaf03c190-10c0.zip/node_modules/@storybook/addon-essentials',
      ],
    };
    const result = getAddonNames(config);
    expect(result).toEqual(['@storybook/addon-essentials']);
  });

  it('should handle mixed addon configurations', () => {
    const config = {
      stories: [],
      addons: [
        '@storybook/addon-actions',
        { name: '@storybook/addon-outline' },
        './local-addon',
        '/sandbox/react-vite-default-ts/node_modules/@storybook/addon-controls',
      ],
    };
    const result = getAddonNames(config);
    expect(result).toEqual([
      '@storybook/addon-actions',
      '@storybook/addon-outline',
      '@storybook/addon-controls',
    ]);
  });
});
