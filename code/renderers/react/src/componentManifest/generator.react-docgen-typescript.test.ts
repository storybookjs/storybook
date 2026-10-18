import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { Tag } from 'storybook/internal/core-server';
import type { IndexEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { manifests } from './generator.ts';
import { type ComponentDocWithExportName, invalidateParser } from './reactDocgenTypescript.ts';
import { invalidateCache } from './utils.ts';

const repoRoot = process.cwd();
const defaultReactDocgenTypescriptPropFilter = Object.assign(
  (prop: { parent?: { fileName?: string } }) =>
    prop.parent ? !/node_modules/.test(prop.parent.fileName ?? '') : true,
  { __storybookDefaultReactDocgenTypescriptPropFilter: true }
);
type ManifestComponentWithReactDocgenTypescript = {
  error?: { name: string; message: string };
  reactDocgenTypescript?: ComponentDocWithExportName;
};

test(
  'manifests uses the referenced app tsconfig for react-docgen-typescript in Vite-style projects',
  { concurrent: false },
  async () => {
    invalidateCache();
    invalidateParser();

    const tempDir = createTempProject();
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    try {
      const result = await manifests(undefined, createManifestOptions());
      const button = result?.components?.components?.['example-button'] as
        | ManifestComponentWithReactDocgenTypescript
        | undefined;

      expect(button?.error).toBeUndefined();
      expect(button?.reactDocgenTypescript?.displayName).toBe('Button');
      expect(button?.reactDocgenTypescript?.props.label).toMatchObject({
        required: true,
      });
      expect(button?.reactDocgenTypescript?.props.primary).toMatchObject({
        required: false,
      });
    } finally {
      cwdSpy.mockRestore();
      invalidateCache();
      invalidateParser();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  'keeps filtering large sources when a custom propFilter is configured',
  { concurrent: false },
  async () => {
    invalidateCache();
    invalidateParser();

    const tempDir = createTempProject();
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    createLargePropSourceFixtures(tempDir);

    try {
      const result = await manifests(
        undefined,
        createManifestOptions(
          {
            reactDocgenTypescriptOptions: {
              propFilter: () => true,
            },
          },
          './src/Select.stories.tsx'
        )
      );
      const select = result?.components?.components?.['example-button'] as
        | ManifestComponentWithReactDocgenTypescript
        | undefined;

      expect(select?.reactDocgenTypescript?.props.options).toBeUndefined();
      expect(select?.reactDocgenTypescript?.props.inheritedProp0).toBeUndefined();
      expect(select?.reactDocgenTypescript?.props.otherProp0).toBeUndefined();
      expect(select?.reactDocgenTypescript?.props.reactProp0).toBeUndefined();
    } finally {
      cwdSpy.mockRestore();
      invalidateCache();
      invalidateParser();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  'keeps filtering large declaration files with the default propFilter',
  { concurrent: false },
  async () => {
    invalidateCache();
    invalidateParser();

    const tempDir = createTempProject();
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    createLargePropSourceFixtures(tempDir);

    try {
      const result = await manifests(
        undefined,
        createManifestOptions({}, './src/Select.stories.tsx')
      );
      const props = (
        result?.components?.components?.['example-button'] as
          | ManifestComponentWithReactDocgenTypescript
          | undefined
      )?.reactDocgenTypescript?.props;

      expect(props?.localProp).toBeDefined();
      expect(props?.localBulkProp0).toBeUndefined();
    } finally {
      cwdSpy.mockRestore();
      invalidateCache();
      invalidateParser();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
);

test(
  'allows selected large prop sources through the component manifest',
  { concurrent: false },
  async () => {
    invalidateCache();
    invalidateParser();

    const tempDir = createTempProject();
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    createLargePropSourceFixtures(tempDir);

    try {
      const result = await manifests(
        undefined,
        createManifestOptions(
          {
            componentManifestLargePropSourceAllowlist: ['wide-library'],
          },
          './src/Select.stories.tsx'
        )
      );
      const select = result?.components?.components?.['example-button'] as
        | ManifestComponentWithReactDocgenTypescript
        | undefined;

      expect(select?.reactDocgenTypescript?.props.options).toBeDefined();
      expect(select?.reactDocgenTypescript?.props.inheritedProp0).toBeDefined();
      expect(
        Object.keys(select?.reactDocgenTypescript?.props ?? {}).filter((name) =>
          name.startsWith('inheritedProp')
        )
      ).toHaveLength(34);
      expect(select?.reactDocgenTypescript?.props.otherProp0).toBeUndefined();
      expect(select?.reactDocgenTypescript?.props.reactProp0).toBeUndefined();
    } finally {
      cwdSpy.mockRestore();
      invalidateCache();
      invalidateParser();
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
);

function createManifestOptions(
  typescriptOptions: Record<string, unknown> = {},
  storyImportPath = './src/Button.stories.tsx'
) {
  const manifestEntries: IndexEntry[] = [
    {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: storyImportPath,
      componentPath: './src/Button.tsx',
      tags: [Tag.DEV, Tag.TEST, Tag.MANIFEST],
      exportName: 'Primary',
    },
  ];

  return {
    watch: false,
    manifestEntries,
    presets: {
      apply: async (extension: string, config?: unknown) => {
        if (extension === 'typescript') {
          return {
            reactDocgen: 'react-docgen-typescript',
            reactDocgenTypescriptOptions: {
              propFilter: defaultReactDocgenTypescriptPropFilter,
            },
            ...typescriptOptions,
          };
        }
        if (extension === 'features') {
          return {};
        }
        return config;
      },
    },
  } as Parameters<typeof manifests>[1];
}

function createLargePropSourceFixtures(tempDir: string) {
  const typeSources = [
    {
      directory: join(tempDir, 'node_modules', '@types', 'react'),
      packageName: '@types/react',
      interfaceName: 'HTMLAttributes',
      propPrefix: 'reactProp',
    },
    {
      directory: join(tempDir, 'node_modules', 'wide-library'),
      packageName: 'wide-library',
      interfaceName: 'WideLibraryProps',
      propPrefix: 'inheritedProp',
    },
    {
      directory: join(tempDir, 'node_modules', 'other-library'),
      packageName: 'other-library',
      interfaceName: 'OtherLibraryProps',
      propPrefix: 'otherProp',
    },
  ];

  for (const { directory, packageName, interfaceName, propPrefix } of typeSources) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({ name: packageName, types: 'index.d.ts' })
    );
    writeFileSync(
      join(directory, 'index.d.ts'),
      `export interface ${interfaceName} {\n${Array.from(
        { length: 34 },
        (_, index) => `  ${propPrefix}${index}: string;`
      ).join('\n')}${packageName === 'wide-library' ? '\n  options: string[];' : ''}\n}`
    );
  }

  writeFileSync(
    join(tempDir, 'src', 'large-local.d.ts'),
    `export interface LocalLargeProps {\n${Array.from(
      { length: 34 },
      (_, index) => `  localBulkProp${index}: string;`
    ).join('\n')}\n}`
  );
  writeFileSync(
    join(tempDir, 'src', 'Select.tsx'),
    `import type { HTMLAttributes } from 'react';\nimport type { WideLibraryProps } from 'wide-library';\nimport type { OtherLibraryProps } from 'other-library';\nimport type { LocalLargeProps } from './large-local';\n\nexport interface SelectProps extends HTMLAttributes, WideLibraryProps, OtherLibraryProps, LocalLargeProps {\n  localProp: string;\n}\n\nexport function Select(props: SelectProps) {\n  return null;\n}\n`
  );
  writeFileSync(
    join(tempDir, 'src', 'Select.stories.tsx'),
    dedent`
      import type { Meta } from '@storybook/react-vite';
      import { Select } from './Select';

      export default {
        title: 'Example/Button',
        component: Select,
      } satisfies Meta<typeof Select>;
    `
  );
}

function createTempProject() {
  const tempDir = mkdtempSync(join(repoRoot, '.tmp-manifest-rdt-'));
  const srcDir = join(tempDir, 'src');

  mkdirSync(srcDir, { recursive: true });

  writeFileSync(
    join(tempDir, 'package.json'),
    JSON.stringify({ name: 'vite-rdt-manifest-fixture', private: true }, null, 2)
  );
  writeFileSync(
    join(tempDir, 'tsconfig.json'),
    JSON.stringify(
      {
        files: [],
        references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }],
      },
      null,
      2
    )
  );
  writeFileSync(
    join(tempDir, 'tsconfig.app.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2
    )
  );
  writeFileSync(
    join(tempDir, 'tsconfig.node.json'),
    JSON.stringify(
      {
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
        },
        include: ['vite.config.ts'],
      },
      null,
      2
    )
  );
  writeFileSync(
    join(srcDir, 'Button.tsx'),
    dedent`
      export interface ButtonProps {
        /** Button contents */
        label: string;
        /** Is this the principal call to action on the page? */
        primary?: boolean;
      }

      /** Primary UI component for user interaction */
      export const Button = ({ label, primary = false }: ButtonProps) => (
        <button data-primary={primary}>{label}</button>
      );
    `
  );
  writeFileSync(
    join(srcDir, 'Button.stories.tsx'),
    dedent`
      import type { Meta, StoryObj } from '@storybook/react-vite';

      import { Button } from './Button';

      const meta = {
        title: 'Example/Button',
        component: Button,
      } satisfies Meta<typeof Button>;

      export default meta;
      type Story = StoryObj<typeof meta>;

      export const Primary: Story = {
        args: {
          label: 'Button',
          primary: true,
        },
      };
    `
  );

  return tempDir;
}
