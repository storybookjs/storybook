import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile } from './formatter.ts';

let root: string;

// The function resolves Prettier and its config from the project on disk, which memfs cannot serve.
const createProject = (files: Record<string, string>) => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'storybook-format-')));
  mkdirSync(join(root, 'node_modules'));
  symlinkSync(
    dirname(createRequire(import.meta.url).resolve('prettier/package.json')),
    join(root, 'node_modules', 'prettier')
  );
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }
  return join(root, 'main.ts');
};

const edited =
  "import type { StorybookConfig } from '@storybook/vue3-vite'\nexport default { addons: ['a','b'] }\n";

describe('formatExistingFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it('formats with the project Prettier config', async () => {
    const file = createProject({ '.prettierrc': '{ "singleQuote": true }' });

    await expect(formatExistingFile(file, edited)).resolves.toBe(
      "import type { StorybookConfig } from '@storybook/vue3-vite';\nexport default { addons: ['a', 'b'] };\n"
    );
  });

  it('uses a CommonJS Prettier whose API Node only exposes as the default export', async () => {
    const file = createProject({ '.prettierrc': '{}' });
    const stub = join(root, 'node_modules', 'cjs-prettier');
    mkdirSync(stub);
    writeFileSync(join(stub, 'package.json'), '{ "name": "prettier", "main": "index.cjs" }');
    writeFileSync(
      join(stub, 'index.cjs'),
      "const api = { resolveConfig: async () => ({}), format: async (code) => 'formatted:' + code };\nmodule.exports = api;\n"
    );
    rmSync(join(root, 'node_modules', 'prettier'));
    symlinkSync(stub, join(root, 'node_modules', 'prettier'));

    // Vitest's module interop exposes CommonJS exports as named exports, which Node does not.
    const formatInNode = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const { formatExistingFile } = await import(${JSON.stringify(pathToFileURL(join(import.meta.dirname, 'formatter.ts')).href)});
         process.stdout.write(await formatExistingFile(${JSON.stringify(file)}, ${JSON.stringify(edited)}));`,
      ],
      { encoding: 'utf8' }
    );

    expect(formatInNode).toBe(`formatted:${edited}`);
  });

  it('accepts a path relative to the working directory, as a relative --config-dir gives it', async () => {
    const file = createProject({ '.prettierrc': '{ "singleQuote": true }' });
    vi.spyOn(process, 'cwd').mockReturnValue(root);

    await expect(formatExistingFile(relative(root, file), edited)).resolves.toBe(
      "import type { StorybookConfig } from '@storybook/vue3-vite';\nexport default { addons: ['a', 'b'] };\n"
    );
  });

  it('leaves the edit alone when the project only has an .editorconfig', async () => {
    const file = createProject({ '.editorconfig': 'root = true\n[*]\nindent_size = 2\n' });

    await expect(formatExistingFile(file, edited)).resolves.toBe(edited);
  });
});
