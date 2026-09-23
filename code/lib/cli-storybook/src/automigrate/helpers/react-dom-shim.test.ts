import { describe, expect, it } from 'vitest';

import { analyzeReactDomShimConfig } from './react-dom-shim.ts';

describe('analyzeReactDomShimConfig', () => {
  it('removes an isolated preset from ESM and CommonJS main configs', () => {
    expect(
      analyzeReactDomShimConfig(
        `export default {
  addons: [
    '@storybook/addon-a11y',
    // The shim is no longer needed.
    '@storybook/react-dom-shim/preset',
    '@storybook/addon-docs',
  ],
};
`,
        '.storybook/main.ts'
      )
    ).toMatchInlineSnapshot();

    expect(
      analyzeReactDomShimConfig(
        `module.exports = {
  presets: ['@storybook/react-dom-shim/preset'],
};
`,
        '.storybook/main.cjs'
      )
    ).toMatchInlineSnapshot();
  });

  it('removes isolated object and array aliases from Vite and Vitest configs', () => {
    expect(
      analyzeReactDomShimConfig(
        `export default {
  resolve: {
    alias: {
      '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16',
      react: 'react',
    },
  },
};
`,
        'vite.config.ts'
      )
    ).toMatchInlineSnapshot();

    expect(
      analyzeReactDomShimConfig(
        `module.exports = {
  resolve: {
    alias: [
      // Legacy shim alias.
      {
        find: '@storybook/react-dom-shim',
        replacement: '@storybook/react-dom-shim/dist/react-16',
      },
      { find: 'react', replacement: 'react' },
    ],
  },
};
`,
        'vitest.config.cjs'
      )
    ).toMatchInlineSnapshot();
  });

  it('leaves the authoritative React Vite fixture unchanged', () => {
    const source = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [],
  framework: '@storybook/react-vite',
};

export default config;
`;

    expect(analyzeReactDomShimConfig(source, 'test-storybooks/upgrade-fixtures/react-vite/.storybook/main.ts')).toMatchInlineSnapshot();
  });

  it.each([
    ["import { renderElement } from '@storybook/react-dom-shim';", 'main.ts'],
    ["export { renderElement } from '@storybook/react-dom-shim';", 'main.ts'],
    ["const shim = require('@storybook/react-dom-shim');", 'main.cjs'],
    ["const shim = import('@storybook/react-dom-shim');", 'main.ts'],
    [
      "const preset = '@storybook/react-dom-shim/preset'; export default { addons: [preset] };",
      'main.ts',
    ],
    [
      "export default { resolve: { alias: { ['@storybook/react-dom-shim']: '@storybook/react-dom-shim/react-16' } } };",
      'vite.config.ts',
    ],
    [
      "export default { resolve: { alias: { ...aliases, '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16' } } };",
      'vite.config.ts',
    ],
    [
      "export default { resolve: { alias: [{ ...legacyAlias }] } };",
      'vitest.config.ts',
    ],
    [
      "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-18' } } };",
      'vite.config.ts',
    ],
    ["export default { addons: ['@storybook/react-dom-shim/preset', ...addons] };", 'main.ts'],
  ])('refuses unsafe source without partial output: %s', (source, filePath) => {
    const result = analyzeReactDomShimConfig(source, filePath);

    expect(result).toMatchObject({ kind: 'manual', source });
    if (result.kind === 'manual') {
      expect(result.diagnostic).toContain(filePath);
    }
  });

  it('returns a file-specific manual diagnostic for malformed source', () => {
    const source = "export default { addons: ['@storybook/react-dom-shim/preset'";

    expect(analyzeReactDomShimConfig(source, '.storybook/main.ts')).toMatchInlineSnapshot();
  });

  it('is idempotent and preserves unrelated source', () => {
    const source = `export default {
  addons: ['@storybook/react-dom-shim/preset', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
};
`;
    const result = analyzeReactDomShimConfig(source, '.storybook/main.ts');

    expect(result).toMatchInlineSnapshot();
    if (result.kind === 'changed') {
      expect(analyzeReactDomShimConfig(result.source, '.storybook/main.ts')).toMatchInlineSnapshot();
    }
  });
});
