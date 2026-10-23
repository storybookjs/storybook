import * as path from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import {
  cleanup,
  createTempDir,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { createDocgenProvider } from './docgen-worker.ts';

// The project's `typescript` is TypeScript 7.1: its main module only carries the version, and the
// API lives in the `typescript/sync` and `typescript/ast` subpaths, here from the `typescript-native`
// alias.
vi.mock('typescript', async () => ({ default: await import('typescript-native') }));
vi.mock('typescript/sync', () => import('typescript-native/sync'));
vi.mock('typescript/ast', () => import('typescript-native/ast'));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

it('extracts docgen on the native API of TypeScript 7.1', { timeout: 30_000 }, async () => {
  tempDir = createTempDir('docgen-worker-native');
  const files = writeFiles(tempDir, {
    'tsconfig.json': tsconfigJSON(),
    'Button.tsx': dedent`
      import React from 'react';
      export interface ButtonProps {
        /** The text of the button. */
        label: string;
        size?: 'small' | 'large';
      }
      export const Button = ({ label, size = 'small' }: ButtonProps) => <button>{label}{size}</button>;
    `,
    'Button.stories.tsx': dedent`
      import { Button } from './Button';
      export default { component: Button, title: 'Forms/Button' };
      export const Primary = { args: { label: 'Hello' } };
    `,
  });
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

  const docgen = await createDocgenProvider()(async () => undefined)({
    entry: {
      type: 'story',
      subtype: 'story',
      id: 'forms-button--primary',
      name: 'Primary',
      title: 'Forms/Button',
      importPath: `./${path.relative(tempDir, files['Button.stories.tsx'])}`,
    } as IndexEntry,
  });

  cwd.mockRestore();
  expect(Object.keys(docgen?.argTypes ?? {})).toEqual(['label', 'size']);
  expect(docgen?.argTypes?.label.description).toBe('The text of the button.');
  expect(docgen?.argTypes?.size.table?.defaultValue?.summary).toBe("'small'");
});
