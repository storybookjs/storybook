import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reactDocgen } from './react-docgen.ts';

const BUTTON = `
import React from 'react';

type ButtonProps = {
  /** The label */
  label: string;
};

export const Button = ({ label }: ButtonProps) => <button>{label}</button>;
`;

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'sb-react-docgen-'));
  // Babel finds `babel.config.*` in the current working directory
  vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(projectDir, { recursive: true, force: true });
});

async function transform(fileName: string, src: string) {
  const plugin = (await reactDocgen()) as {
    transform: (src: string, id: string) => Promise<{ code: string } | undefined>;
  };
  const id = join(projectDir, fileName);
  await writeFile(id, src);
  return plugin.transform(src, id);
}

describe('react-docgen and the project Babel config', () => {
  it('documents TSX when the project Babel config only adds a plugin', async () => {
    const noopPlugin = join(projectDir, 'noop-plugin.cjs');
    await writeFile(noopPlugin, 'module.exports = () => ({ visitor: {} });');
    await writeFile(
      join(projectDir, 'babel.config.json'),
      JSON.stringify({ plugins: [noopPlugin] })
    );

    const result = await transform('Button.tsx', BUTTON);

    expect(result?.code).toContain('Button.__docgenInfo=');
    expect(result?.code).toContain('"label"');
  });

  it('documents components the same way without a project Babel config', async () => {
    const result = await transform('Button.tsx', BUTTON);

    const docgenInfo = result?.code.split('Button.__docgenInfo=')[1];
    expect(JSON.parse(docgenInfo!)).toMatchInlineSnapshot(`
      {
        "description": "",
        "displayName": "Button",
        "methods": [],
        "props": {
          "label": {
            "description": "The label",
            "required": true,
            "tsType": {
              "name": "string",
            },
          },
        },
      }
    `);
  });

  it('falls back to the project Babel config for syntax react-docgen does not parse', async () => {
    // A syntax plugin, the way `@babel/preset-typescript` or `@babel/plugin-syntax-*` add syntax
    const syntaxPlugin = join(projectDir, 'syntax-plugin.cjs');
    await writeFile(
      syntaxPlugin,
      `module.exports = () => ({
        manipulateOptions(_opts, parserOpts) {
          parserOpts.plugins.push('jsx', 'typescript', 'v8intrinsic');
        },
      });`
    );
    await writeFile(
      join(projectDir, 'babel.config.json'),
      JSON.stringify({ plugins: [syntaxPlugin] })
    );

    const result = await transform(
      'Intrinsic.tsx',
      `
import React from 'react';

export const Intrinsic = ({ label }: { label: string }) => {
  %DebugPrint(label);
  return <span>{label}</span>;
};
`
    );

    expect(result?.code).toContain('Intrinsic.__docgenInfo=');
  });

  it('ignores files without a component', async () => {
    const result = await transform(
      'utils.ts',
      'export const add = (a: number, b: number) => a + b;'
    );

    expect(result).toBeUndefined();
  });
});
