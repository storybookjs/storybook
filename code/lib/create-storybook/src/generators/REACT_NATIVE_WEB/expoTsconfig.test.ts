import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { rewriteExpoTsconfigBase, rewriteExpoTsconfigFile } from './expoTsconfig.ts';

vi.mock('node:fs/promises', { spy: true });

const tsconfig = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true }
}
`;

describe('rewriteExpoTsconfigBase', () => {
  it('appends .json to an extensionless Expo tsconfig extends', () => {
    expect(rewriteExpoTsconfigBase(tsconfig)).toContain('"extends": "expo/tsconfig.base.json"');
  });

  it('leaves an extends that already ends in .json unchanged', () => {
    const source = tsconfig.replace('expo/tsconfig.base"', 'expo/tsconfig.base.json"');
    expect(rewriteExpoTsconfigBase(source)).toBe(source);
  });

  it('rewrites expo/tsconfig.base inside an extends array', () => {
    const source = '{ "extends": ["expo/tsconfig.base", "./tsconfig.shared.json"] }';
    const rewritten = rewriteExpoTsconfigBase(source);
    expect(rewritten).toContain('"expo/tsconfig.base.json"');
    expect(rewritten).toContain('"./tsconfig.shared.json"');
  });

  it('does not rewrite other extends values', () => {
    const source = '{ "extends": "./tsconfig.base" }';
    expect(rewriteExpoTsconfigBase(source)).toBe(source);
  });
});

describe('rewriteExpoTsconfigFile', () => {
  const projectDir = resolve('/app');
  const tsconfigPath = resolve(projectDir, 'tsconfig.json');

  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  it('rewrites the project tsconfig when it extends expo/tsconfig.base', async () => {
    vol.fromNestedJSON({ [tsconfigPath]: tsconfig });

    await rewriteExpoTsconfigFile(projectDir);

    expect(vol.toJSON()[tsconfigPath]).toContain('"extends": "expo/tsconfig.base.json"');
  });

  it('does nothing when the project has no tsconfig', async () => {
    vol.fromNestedJSON({ [resolve(projectDir, 'package.json')]: '{}' });

    await expect(rewriteExpoTsconfigFile(projectDir)).resolves.toBeUndefined();
    expect(vol.toJSON()[tsconfigPath]).toBeUndefined();
  });
});
