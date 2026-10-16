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

// TypeScript 4.x is a CommonJS module whose exports ESM cannot detect, so a dynamic import only
// exposes the API through `default`.
vi.mock('typescript', async (importOriginal) => ({
  default: await importOriginal<typeof import('typescript')>(),
}));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    cleanup(tempDir);
    tempDir = undefined;
  }
});

it(
  'extracts docgen when TypeScript is only reachable through its default export',
  { timeout: 30_000 },
  async () => {
    tempDir = createTempDir('docgen-worker');
    const files = writeFiles(tempDir, {
      'tsconfig.json': tsconfigJSON(),
      'Button.tsx': dedent`
        import React from 'react';
        export const Button = ({ label }: { label: string }) => <button>{label}</button>;
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
    expect(Object.keys(docgen?.argTypes ?? {})).toEqual(['label']);
  }
);
