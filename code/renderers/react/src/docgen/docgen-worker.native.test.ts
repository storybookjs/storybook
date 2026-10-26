import * as path from 'pathe';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { loadDocgenTypeScript } from '@storybook/component-meta-typescript';
import {
  cleanup,
  createTempDir,
  loadNativeTypeScriptModules,
  tsconfigJSON,
  writeFiles,
} from '../componentManifest/componentMeta/test-helpers.ts';
import { createDocgenProvider } from './docgen-worker.ts';

vi.mock('@storybook/component-meta-typescript', { spy: true });

let tempDir: string;

// The worker loads the project's `typescript`; here that is TypeScript 7.1 from the
// `typescript-native` alias, whose API lives in the `sync` and `ast` subpaths.
beforeEach(async () => {
  vi.mocked(loadDocgenTypeScript).mockResolvedValue({
    api: 'native',
    typescript: await loadNativeTypeScriptModules(),
  });
  tempDir = createTempDir('docgen-worker-native');
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
});

afterEach(() => {
  vi.mocked(process.cwd).mockRestore();
  cleanup(tempDir);
});

it(
  'hands the docgenSpecifier to the loader and extracts docgen on the native API',
  { timeout: 30_000 },
  async () => {
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

    const typeScriptSpecifier = { specifier: '@typescript/native', configDir: tempDir };
    const docgen = await createDocgenProvider({ typeScriptSpecifier })(async () => undefined)({
      entry: {
        type: 'story',
        subtype: 'story',
        id: 'forms-button--primary',
        name: 'Primary',
        title: 'Forms/Button',
        importPath: `./${path.relative(tempDir, files['Button.stories.tsx'])}`,
      } as IndexEntry,
    });

    expect(loadDocgenTypeScript).toHaveBeenCalledWith(typeScriptSpecifier);
    expect(Object.keys(docgen?.argTypes ?? {})).toEqual(['label', 'size']);
    expect(docgen?.argTypes?.label.description).toBe('The text of the button.');
    expect(docgen?.argTypes?.size.table?.defaultValue?.summary).toBe("'small'");
  }
);
