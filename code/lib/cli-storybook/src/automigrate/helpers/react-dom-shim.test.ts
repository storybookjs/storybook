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
    ).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "export default {
        addons: ['@storybook/addon-a11y', // The shim is no longer needed.
        "@storybook/addon-docs"],
      };
      ",
      }
    `);

    expect(
      analyzeReactDomShimConfig(
        `module.exports = {
  presets: [
    // The shim is no longer needed.
    '@storybook/react-dom-shim/preset',
  ],
};
`,
        '.storybook/main.cjs'
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "module.exports = {
        presets: // The shim is no longer needed.
        [],
      };
      ",
      }
    `);
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
    ).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "export default {
        resolve: {
          alias: {
            react: 'react'
          },
        },
      };
      ",
      }
    `);

    expect(
      analyzeReactDomShimConfig(
        `module.exports = {
  resolve: {
    alias: [
      // Legacy shim alias.
      {
        // Legacy find value.
        find: '@storybook/react-dom-shim',
        // Legacy replacement value.
        replacement: '@storybook/react-dom-shim/dist/react-16',
      },
      { find: 'react', replacement: 'react' },
    ],
  },
};
`,
        'vitest.config.cjs'
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "module.exports = {
        resolve: {
          alias: [// Legacy shim alias.
          // Legacy find value.
          // Legacy replacement value.
          {
            find: 'react',
            replacement: 'react'
          }],
        },
      };
      ",
      }
    `);
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

    expect(
      analyzeReactDomShimConfig(
        source,
        'test-storybooks/upgrade-fixtures/react-vite/.storybook/main.ts'
      )
    ).toMatchInlineSnapshot(`
      {
        "kind": "unchanged",
      }
    `);
  });

  it('removes the preset from an exported typed config binding', () => {
    const source = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: ['@storybook/react-dom-shim/preset'],
  framework: '@storybook/react-vite',
};

export default config;
`;

    expect(analyzeReactDomShimConfig(source, 'main.ts')).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "import type { StorybookConfig } from '@storybook/react-vite';

      const config: StorybookConfig = {
        addons: [],
        framework: '@storybook/react-vite',
      };

      export default config;
      ",
      }
    `);
  });

  it('removes the alias from a defineConfig call', () => {
    const source = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@storybook/react-dom-shim': '@storybook/react-dom-shim/dist/react-16',
    },
  },
});
`;

    expect(analyzeReactDomShimConfig(source, 'vitest.config.ts')).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "import { defineConfig } from 'vitest/config';

      export default defineConfig({
        resolve: {
          alias: {},
        },
      });
      ",
      }
    `);
  });

  it.each([
    ["import { renderElement } from '@storybook/react-dom-shim';", 'main.ts'],
    ["export { renderElement } from '@storybook/react-dom-shim';", 'main.ts'],
    ["const shim = require('@storybook/react-dom-shim');", 'main.cjs'],
    ["const shim = import('@storybook/react-dom-shim');", 'main.ts'],
    ['const shim = import(`@storybook/react-dom-shim`);', 'main.ts'],
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
      "export default { resolve: { alias: [{ ...legacyAlias, find: '@storybook/react-dom-shim', replacement: '@storybook/react-dom-shim/react-16' }] } };",
      'vitest.config.ts',
    ],
    [
      "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-18' } } };",
      'vite.config.ts',
    ],
    ["export default { addons: ['@storybook/react-dom-shim/preset', ...addons] };", 'main.ts'],
    [
      "export default { addons: ['@storybook/react-dom-shim/preset'], custom: '@storybook/react-dom-shim/react-18' };",
      'main.ts',
    ],
    [
      "export default { addons: ['@storybook/react-dom-shim/preset'], shim: `${'@storybook/'}react-dom-shim` };",
      'main.ts',
    ],
    [
      "export default { resolve: { alias: [{ find: '@storybook/react-dom-shim', replacement: '@storybook/react-dom-shim/react-16', customResolver: initializeResolver() }] } };",
      'vite.config.ts',
    ],
    [
      "export default { resolve: { alias: [{ find: '@storybook/react-dom-shim', find: 'react', replacement: '@storybook/react-dom-shim/react-16' }] } };",
      'vite.config.ts',
    ],
    ["export default { ...base, addons: ['@storybook/react-dom-shim/preset'] };", 'main.ts'],
    [
      "export default { resolve: { alias: [createAlias(), { find: '@storybook/react-dom-shim', replacement: '@storybook/react-dom-shim/react-16' }] } };",
      'vite.config.ts',
    ],
    [
      "const module = { exports: null }; module.exports = { presets: ['@storybook/react-dom-shim/preset'] }; export default module;",
      'main.js',
    ],
  ])('refuses unsafe source without partial output: %s', (source, filePath) => {
    const result = analyzeReactDomShimConfig(source, filePath);

    expect(result).toMatchObject({ kind: 'manual', source });
    if (result.kind === 'manual') {
      expect(result.diagnostic).toContain(filePath);
    }
  });

  it('returns a file-specific manual diagnostic for malformed source', () => {
    const source = "export default { addons: ['@storybook/react-dom-shim/preset'";

    expect(analyzeReactDomShimConfig(source, '.storybook/main.ts')).toMatchInlineSnapshot(`
      {
        "diagnostic": ".storybook/main.ts: cannot parse this config safely",
        "kind": "manual",
        "source": "export default { addons: ['@storybook/react-dom-shim/preset'",
      }
    `);
  });

  it.each([
    "const shim = import('@storybook/' + 'react-dom-shim');",
    "const shim = require('@storybook/' + 'react-dom-shim');",
    "const shim = import(`${'@storybook/'}react-dom-shim`);",
    "const name = 'react-dom-shim'; const shim = import(`@storybook/${name}`);",
  ])('refuses computed module loads before removing a preset: %s', (moduleLoad) => {
    const source = `${moduleLoad}\nexport default { addons: ['@storybook/react-dom-shim/preset'] };`;
    const result = analyzeReactDomShimConfig(source, '.storybook/main.ts');

    expect(result).toMatchObject({ kind: 'manual', source });
    if (result.kind === 'manual') {
      expect(result.diagnostic).toContain('.storybook/main.ts');
    }
  });

  it('is idempotent and preserves unrelated source', () => {
    const source = `export default {
  addons: ['@storybook/react-dom-shim/preset', '@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
};
`;
    const result = analyzeReactDomShimConfig(source, '.storybook/main.ts');

    expect(result).toMatchInlineSnapshot(`
      {
        "kind": "changed",
        "source": "export default {
        addons: ['@storybook/addon-a11y'],
        framework: '@storybook/react-vite',
      };
      ",
      }
    `);
    if (result.kind === 'changed') {
      expect(analyzeReactDomShimConfig(result.source, '.storybook/main.ts')).toMatchInlineSnapshot(`
        {
          "kind": "unchanged",
        }
      `);
    }
  });
});
