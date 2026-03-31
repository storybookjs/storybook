import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, vi } from 'vitest';

import { Tag } from 'storybook/internal/core-server';
import type { IndexEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { manifests } from './generator';
import { invalidateParser } from './reactDocgenTypescript';
import { invalidateCache } from './utils';

const repoRoot = process.cwd();

test.sequential('manifests uses the referenced app tsconfig for react-docgen-typescript in Vite-style projects', async () => {
  invalidateCache();
  invalidateParser();

  const tempDir = createTempProject();
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

  try {
    const result = await manifests(undefined, createManifestOptions());
    const button = result?.components?.components?.['example-button'];

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
});

function createManifestOptions() {
  const manifestEntries: IndexEntry[] = [
    {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: './src/Button.stories.tsx',
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
          return { reactDocgen: 'react-docgen-typescript' };
        }
        if (extension === 'features') {
          return {};
        }
        return config;
      },
    },
  } as Parameters<typeof manifests>[1];
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
