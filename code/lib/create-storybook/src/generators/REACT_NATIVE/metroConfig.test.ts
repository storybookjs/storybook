import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { prompt } from 'storybook/internal/node-logger';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';

import {
  METRO_FALLBACK_COMMENT_MARKER,
  containsStorybookImport,
  prependMetroFallbackComment,
  runMetroCodemodOrFallback,
  transformMetroConfigSource,
} from './metroConfig';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('metroConfig codemod', () => {
  let tempDir: string;
  let originalCwd: string;
  let packageManager: JsPackageManager;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'sb-rn-metro-'));
    process.chdir(tempDir);

    packageManager = {
      getDependencyVersion: vi.fn().mockReturnValue(null),
      runInternalCommand: vi.fn(),
    } as unknown as JsPackageManager;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('wraps module.exports object config and injects require import', async () => {
    const filePath = path.join(tempDir, 'metro.config.js');
    await writeFile(
      filePath,
      'const defaultConfig = {};\nmodule.exports = defaultConfig;\n',
      'utf-8'
    );

    const result = await runMetroCodemodOrFallback({ packageManager, yes: true });
    const updatedSource = await readFile(filePath, 'utf-8');

    expect(result.status).toBe('updated');
    expect(updatedSource).toContain("require('@storybook/react-native/metro');");
    expect(updatedSource).toContain('module.exports = withStorybook(defaultConfig);');
  });

  it('wraps existing wrapper as outermost withStorybook', async () => {
    const filePath = path.join(tempDir, 'metro.config.js');
    await writeFile(filePath, 'module.exports = withExpo(defaultConfig);\n', 'utf-8');

    const result = await runMetroCodemodOrFallback({ packageManager, yes: true });
    const updatedSource = await readFile(filePath, 'utf-8');

    expect(result.status).toBe('updated');
    expect(updatedSource).toContain('module.exports = withStorybook(withExpo(defaultConfig));');
  });

  it('wraps export default async function in ts config with ESM import', () => {
    const source = `
export default async function makeMetroConfig() {
  return { resolver: {} };
}
`;
    const transformed = transformMetroConfigSource(source, path.join(tempDir, 'metro.config.ts'));

    expect(transformed.action).toBe('updated');
    if (transformed.action === 'updated') {
      expect(transformed.code).toContain(
        "import { withStorybook } from '@storybook/react-native/metro';"
      );
      expect(transformed.code).toContain(
        'export default withStorybook(async function makeMetroConfig()'
      );
    }
  });

  it('preserves TypeScript return type and type parameters on default exported functions', () => {
    const source = `
import type { MetroConfig } from 'metro-config';

export default async function makeMetroConfig<T = string>(): Promise<MetroConfig> {
  return {} as MetroConfig;
}
`;
    const transformed = transformMetroConfigSource(source, path.join(tempDir, 'metro.config.ts'));

    expect(transformed.action).toBe('updated');
    if (transformed.action === 'updated') {
      expect(transformed.code).toContain('function makeMetroConfig<T = string>()');
      expect(transformed.code).toContain(': Promise<MetroConfig>');
    }
  });

  it('is idempotent when run twice', async () => {
    const filePath = path.join(tempDir, 'metro.config.js');
    await writeFile(filePath, 'const config = {};\nmodule.exports = config;\n', 'utf-8');

    const first = await runMetroCodemodOrFallback({ packageManager, yes: true });
    const firstOutput = await readFile(filePath, 'utf-8');
    const second = await runMetroCodemodOrFallback({ packageManager, yes: true });
    const secondOutput = await readFile(filePath, 'utf-8');

    expect(first.status).toBe('updated');
    expect(second.status).toBe('skipped-existing-storybook-import');
    expect(secondOutput).toBe(firstOutput);
  });

  it('skips codemod when storybook import already exists', async () => {
    const filePath = path.join(tempDir, 'metro.config.js');
    await writeFile(
      filePath,
      "const { withStorybook } = require('@storybook/react-native/metro');\nmodule.exports = withStorybook({});\n",
      'utf-8'
    );

    const result = await runMetroCodemodOrFallback({ packageManager, yes: true });

    expect(result.status).toBe('skipped-existing-storybook-import');
  });

  it('prompts for file selection when multiple metro configs exist', async () => {
    await writeFile(path.join(tempDir, 'metro.config.js'), 'module.exports = {};\n', 'utf-8');
    await writeFile(path.join(tempDir, 'metro.config.ts'), 'export default {};\n', 'utf-8');
    vi.mocked(prompt.select).mockResolvedValue(path.join(tempDir, 'metro.config.ts'));

    const result = await runMetroCodemodOrFallback({ packageManager, yes: false });

    expect(prompt.select).toHaveBeenCalled();
    expect(result.filePath).toBe(path.join(tempDir, 'metro.config.ts'));
  });

  it('skips automatically in --yes mode when non-expo metro config is missing', async () => {
    const result = await runMetroCodemodOrFallback({ packageManager, yes: true });

    expect(result.status).toBe('skipped-missing-file');
  });

  it('uses prompt path for missing non-expo metro config', async () => {
    const externalPath = path.join(tempDir, 'custom-metro.config.js');
    await writeFile(externalPath, 'module.exports = {};\n', 'utf-8');
    vi.mocked(prompt.text).mockResolvedValue('./custom-metro.config.js');

    const result = await runMetroCodemodOrFallback({ packageManager, yes: false });
    const updated = await readFile(externalPath, 'utf-8');

    expect(prompt.text).toHaveBeenCalled();
    expect(result.status).toBe('updated');
    expect(updated).toContain('withStorybook');
  });

  it('adds fallback comment on unsupported config shape', async () => {
    const filePath = path.join(tempDir, 'metro.config.js');
    await writeFile(filePath, 'const noExportHere = true;\n', 'utf-8');

    const result = await runMetroCodemodOrFallback({ packageManager, yes: true });
    const updated = await readFile(filePath, 'utf-8');

    expect(result.status).toBe('fallback-commented');
    expect(updated).toContain(METRO_FALLBACK_COMMENT_MARKER);
  });

  it('containsStorybookImport detects both import and require usage', () => {
    expect(
      containsStorybookImport("import { withStorybook } from '@storybook/react-native/metro';")
    ).toBe(true);
    expect(containsStorybookImport("const sb = require('storybook/internal/common');")).toBe(true);
    expect(containsStorybookImport('const x = require("react-native");')).toBe(false);
  });

  it('prepends fallback comment only once', () => {
    const original = 'module.exports = {};\n';
    const once = prependMetroFallbackComment(original);
    const twice = prependMetroFallbackComment(once);

    expect(once).toContain(METRO_FALLBACK_COMMENT_MARKER);
    expect(twice).toBe(once);
  });
});
