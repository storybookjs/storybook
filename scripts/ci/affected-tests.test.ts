import { describe, expect, it } from 'vitest';

import { type BuiltPackage, isGlobalInput, selectAffectedTests } from './affected-tests.ts';

const core: BuiltPackage = {
  dir: 'code/core',
  metafiles: [
    {
      outputs: {
        'dist/preview-api/index.js': { inputs: {} },
        'dist/_browser-chunks/chunk-PREVIEW.js': {
          inputs: {
            'src/preview-api/modules/preview-web/PreviewWithSelection.tsx': {},
            '../../node_modules/lodash/index.js': {},
          },
        },
        'dist/_browser-chunks/chunk-MANAGER.js': {
          inputs: { 'src/manager/App.tsx': {} },
        },
      },
    },
    {
      outputs: {
        'dist/_node-chunks/chunk-SHARED.js': {
          inputs: { 'src/shared/utils/local-hosts.ts': {} },
        },
        'dist/_browser-chunks/chunk-SHARED.js': {
          inputs: { 'src/shared/utils/local-hosts.ts': {} },
        },
      },
    },
  ],
  distFiles: [
    'code/core/dist/_browser-chunks/chunk-MANAGER.js',
    'code/core/dist/_browser-chunks/chunk-PREVIEW.js',
    'code/core/dist/preview-api/index.js',
  ],
  testFiles: ['code/core/src/manager/App.test.tsx'],
};

const a11y: BuiltPackage = {
  dir: 'code/addons/a11y',
  metafiles: undefined,
  distFiles: ['code/addons/a11y/dist/index.js', 'code/addons/a11y/dist/preview.js'],
  testFiles: ['code/addons/a11y/src/a11yRunner.test.ts', 'code/addons/a11y/src/preview.test.tsx'],
};

const packages = [core, a11y];

const related = (...files: string[]) => selectAffectedTests(files, packages);

describe('selectAffectedTests', () => {
  it('maps a source file to itself and the chunk that bundles it', () => {
    expect(
      related('code/core/src/preview-api/modules/preview-web/PreviewWithSelection.tsx')
    ).toEqual([
      'code/core/dist/_browser-chunks/chunk-PREVIEW.js',
      'code/core/src/preview-api/modules/preview-web/PreviewWithSelection.tsx',
    ]);
  });

  it('maps a source file bundled into several outputs to each of them', () => {
    expect(related('code/core/src/shared/utils/local-hosts.ts')).toEqual([
      'code/core/dist/_browser-chunks/chunk-SHARED.js',
      'code/core/dist/_node-chunks/chunk-SHARED.js',
      'code/core/src/shared/utils/local-hosts.ts',
    ]);
  });

  it("widens to all of a package's dist when its metafiles are missing", () => {
    expect(related('code/addons/a11y/src/a11yRunner.ts')).toEqual([
      'code/addons/a11y/dist/index.js',
      'code/addons/a11y/dist/preview.js',
      'code/addons/a11y/src/a11yRunner.ts',
    ]);
  });

  it("keeps a package's own dist when only another package's metafile mentions the file", () => {
    const bundlesA11y: BuiltPackage = {
      ...core,
      metafiles: [
        {
          outputs: {
            'dist/_node-chunks/chunk-A11Y.js': {
              inputs: { '../addons/a11y/src/constants.ts': {} },
            },
          },
        },
      ],
    };

    expect(selectAffectedTests(['code/addons/a11y/src/constants.ts'], [bundlesA11y, a11y])).toEqual(
      [
        ...a11y.distFiles,
        'code/addons/a11y/src/constants.ts',
        'code/core/dist/_node-chunks/chunk-A11Y.js',
      ]
    );
  });

  it("widens to all of a package's dist when no metafile mentions the source file", () => {
    expect(related('code/core/src/types/modules/addons.ts')).toEqual([
      ...core.distFiles,
      'code/core/src/types/modules/addons.ts',
    ]);
  });

  it('runs a changed test file without widening to its package', () => {
    expect(related('code/core/src/preview-api/modules/preview-web/PreviewWeb.test.ts')).toEqual([
      'code/core/src/preview-api/modules/preview-web/PreviewWeb.test.ts',
    ]);
  });

  it.each([
    'code/addons/a11y/src/__snapshots__/a11yRunner.test.ts.snap',
    'code/addons/a11y/src/__fixtures__/axe-result.ts',
    'code/addons/a11y/src/fixtures/results.json',
    'code/addons/a11y/README.md',
  ])('runs every test of the package when %s changed', (asset) => {
    expect(related(asset)).toEqual(a11y.testFiles);
  });

  it('selects nothing for a change outside every package', () => {
    expect(related('docs/get-started/introduction.mdx', '.github/workflows/fmt.yml')).toEqual([]);
  });
});

describe('isGlobalInput', () => {
  it.each([
    'yarn.lock',
    '.yarnrc.yml',
    'nx.json',
    '.nvmrc',
    'tsconfig.json',
    'code/core/package.json',
    'code/core/tsconfig.build.json',
    'code/vitest.shared.ts',
    'code/vitest-setup.ts',
    'code/vitest.config.storybook.ts',
    'code/addons/a11y/vitest.config.ts',
    'code/builders/builder-vite/vite.config.ts',
    'code/__mocks__/fs.ts',
    '.yarn/patches/@vitest-expect-npm-3.2.4-97c526d5cc.patch',
  ])('treats %s as a global input', (file) => {
    expect(isGlobalInput(file)).toBe(true);
  });

  it.each([
    'code/core/src/manager/App.tsx',
    'code/core/src/manager/App.test.tsx',
    'code/addons/a11y/README.md',
    'docs/get-started/introduction.mdx',
  ])('does not treat %s as a global input', (file) => {
    expect(isGlobalInput(file)).toBe(false);
  });
});
