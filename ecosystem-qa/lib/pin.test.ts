import { describe, expect, it } from 'vitest';

import { packageManagerOf, pnpmCatalogs, storybookDirsOf, storybookFacts } from './pin.ts';

describe('packageManagerOf', () => {
  it.each([
    ['package-lock.json', 'npm'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
  ])('names the manager of a root %s', (lockfile, manager) => {
    expect(packageManagerOf(['package.json', lockfile, 'packages/a/package-lock.json'])).toBe(
      manager
    );
  });

  it('names none when the root has no lockfile or the lockfiles of two managers', () => {
    expect(packageManagerOf(['package.json', 'packages/a/yarn.lock'])).toBeNull();
    expect(packageManagerOf(['yarn.lock', 'package-lock.json'])).toBeNull();
  });
});

describe('storybookDirsOf', () => {
  it('finds the package directory of each main config, outside node_modules', () => {
    const paths = [
      'package.json',
      '.storybook/main.ts',
      'packages/eui/package.json',
      'packages/eui/.storybook/main.mts',
      'packages/eui/.storybook/preview.tsx',
      'storybook/main.js',
      'tools/storybook/package.json',
      'tools/storybook/main.ts',
      'apps/ui-storybook/.storybook/main.ts',
      'node_modules/x/.storybook/main.js',
      'src/main.ts',
    ];

    expect(storybookDirsOf(paths)).toEqual([
      { dir: '.', main: '.storybook/main.ts' },
      { dir: 'packages/eui', main: 'packages/eui/.storybook/main.mts' },
      { dir: '.', main: 'storybook/main.js' },
      { dir: 'tools/storybook', main: 'tools/storybook/main.ts' },
      { dir: '.', main: 'apps/ui-storybook/.storybook/main.ts' },
    ]);
  });
});

describe('storybookFacts', () => {
  it('reads the directory over the root and resolves a pnpm catalog', () => {
    const own = {
      devDependencies: {
        storybook: 'catalog:',
        '@storybook/svelte-vite': 'catalog:',
        '@storybook/addon-vitest': 'catalog:',
      },
    };
    const root = { devDependencies: { storybook: '^9.0.0', 'msw-storybook-addon': '^2.0.0' } };
    const catalogs = pnpmCatalogs(
      [
        'packages:',
        '  - ui/*',
        'catalog:',
        "  '@storybook/svelte-vite': ^10.4.4",
        '  storybook: ^10.4.4 # pinned for the docs',
        'catalogs:',
        '  old:',
        '    storybook: ^8.0.0',
      ].join('\n')
    );

    expect(storybookFacts(own, root, { catalogs })).toEqual({
      storybook: '^10.4.4',
      major: 10,
      frameworks: ['@storybook/svelte-vite'],
      features: ['msw', 'vitest'],
    });
    expect(
      storybookFacts({ devDependencies: { storybook: 'catalog:old' } }, {}, { catalogs }).major
    ).toBe(8);
  });

  it('takes the version of the framework package where storybook is not declared', () => {
    expect(storybookFacts({ devDependencies: { '@storybook/react-vite': '^10.6.3' } }, {})).toEqual(
      expect.objectContaining({ storybook: '^10.6.3', major: 10 })
    );
  });

  it('keeps the framework that the main config names when several are installed', () => {
    const own = {
      devDependencies: {
        storybook: '10.6.0',
        '@storybook/angular': '10.6.0',
        '@storybook/web-components-vite': '10.6.0',
      },
    };
    const main = 'framework: { name: getAbsolutePath("@storybook/angular"), options: {} },';

    expect(storybookFacts(own, {}).frameworks).toEqual([
      '@storybook/angular',
      '@storybook/web-components-vite',
    ]);
    expect(storybookFacts(own, {}, { main }).frameworks).toEqual(['@storybook/angular']);
  });

  it('gives no major for a range it cannot read', () => {
    expect(storybookFacts({ dependencies: { storybook: 'workspace:*' } }, {}).major).toBeNull();
  });
});
