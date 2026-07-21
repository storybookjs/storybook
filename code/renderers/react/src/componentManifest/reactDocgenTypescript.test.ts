import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { cleanup, createTempDir } from './componentMeta/test-helpers.ts';
import { invalidateParser, parseWithReactDocgenTypescript } from './reactDocgenTypescript.ts';
import { invalidateCache } from './utils.ts';

const originalCwd = process.cwd();

function writeFiles(baseDir: string, files: Record<string, string>) {
  const filePaths: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(baseDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    filePaths[name] = filePath;
  }
  return filePaths;
}

describe('parseWithReactDocgenTypescript', () => {
  let tempDir: string | undefined;

  beforeEach(() => {
    invalidateCache();
    invalidateParser();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    invalidateCache();
    invalidateParser();

    if (tempDir) {
      cleanup(tempDir);
      tempDir = undefined;
    }
  });

  it('uses a referenced tsconfig that contains the component file', async () => {
    tempDir = createTempDir('react-docgen-typescript-test');
    const files = writeFiles(tempDir, {
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
      }),
      'tsconfig.app.json': JSON.stringify({
        extends: './tsconfig.base.json',
        compilerOptions: {
          composite: true,
        },
        include: ['src'],
      }),
      'src/Button.tsx': dedent`
        export type ButtonProps = {
          label: string;
          primary?: boolean;
        };

        export function Button({ label }: ButtonProps) {
          return <button>{label}</button>;
        }
      `,
    });

    process.chdir(tempDir);

    const docs = await parseWithReactDocgenTypescript(files['src/Button.tsx']);

    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      displayName: 'Button',
      exportName: 'Button',
      props: {
        label: {
          required: true,
          type: { name: 'string' },
        },
        primary: {
          required: false,
          type: { name: 'boolean' },
        },
      },
    });
  });
});
