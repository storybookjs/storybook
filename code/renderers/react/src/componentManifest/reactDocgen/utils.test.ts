import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import ts from 'typescript';

import { invalidateCache } from '../utils.ts';
import { getTsConfig } from './utils.ts';

const tempDirs: string[] = [];

afterEach(() => {
  invalidateCache();
  vi.restoreAllMocks();

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('getTsConfig', () => {
  it('reads the tsconfig named by tsconfigPath instead of the one owning the component', async () => {
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'preserve', target: 'ES5' },
        include: ['src'],
      }),
      'tsconfig.storybook.json': JSON.stringify({
        compilerOptions: { jsx: 'react-jsx', target: 'ES2022' },
        include: ['src'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    const options = await getTsConfig(
      path.join(dir, 'src/Button.tsx'),
      './tsconfig.storybook.json'
    );

    expect(options.jsx).toBe(ts.JsxEmit.ReactJSX);
    expect(options.target).toBe(ts.ScriptTarget.ES2022);
  });

  it('warns and falls back to the owning tsconfig when tsconfigPath does not exist', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const dir = createTempProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { jsx: 'preserve', target: 'ES5' },
        include: ['src'],
      }),
      'src/Button.tsx': 'export const Button = () => null;',
    });

    const options = await getTsConfig(path.join(dir, 'src/Button.tsx'), './tsconfig.missing.json');

    expect(options.jsx).toBe(ts.JsxEmit.Preserve);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tsconfig.missing.json'));
  });
});

function createTempProject(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'sb-rdt-tsconfig-'));
  tempDirs.push(dir);

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(dir, name);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }

  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  return dir;
}
