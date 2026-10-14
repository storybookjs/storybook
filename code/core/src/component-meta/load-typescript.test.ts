import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';

import { loadTypeScriptCompilerApi } from './load-typescript.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const withCompilerApi = (version: string) => ({ version, sys: { fileExists: () => true } });
const versionOnly = (version: string) => ({ version });
const missing = () => Promise.reject(new Error('Cannot find module'));

describe('loadTypeScriptCompilerApi', () => {
  beforeEach(() => {
    once.clear();
    vi.mocked(once.warn).mockClear();
  });

  it('uses the project TypeScript when it is older than 7', async () => {
    const projectTypeScript = withCompilerApi('6.0.3');

    const result = await loadTypeScriptCompilerApi({
      typescript: async () => projectTypeScript,
      typescript6: async () => withCompilerApi('6.0.2'),
    });

    expect(result).toBe(projectTypeScript);
  });

  it('unwraps the default export of the imported module', async () => {
    const projectTypeScript = withCompilerApi('5.9.3');

    const result = await loadTypeScriptCompilerApi({
      typescript: async () => ({ default: projectTypeScript }),
      typescript6: missing,
    });

    expect(result).toBe(projectTypeScript);
  });

  it('falls back to @typescript/typescript6 when the project uses TypeScript 7', async () => {
    const typescript6 = withCompilerApi('6.0.2');

    const result = await loadTypeScriptCompilerApi({
      typescript: async () => versionOnly('7.0.2'),
      typescript6: async () => typescript6,
    });

    expect(result).toBe(typescript6);
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('falls back even when TypeScript 7 exposes a `sys` object', async () => {
    const typescript6 = withCompilerApi('6.0.2');

    const result = await loadTypeScriptCompilerApi({
      typescript: async () => withCompilerApi('7.1.0'),
      typescript6: async () => typescript6,
    });

    expect(result).toBe(typescript6);
  });

  it('warns when TypeScript 7 is installed without @typescript/typescript6', async () => {
    const result = await loadTypeScriptCompilerApi({
      typescript: async () => versionOnly('7.0.2'),
      typescript6: missing,
    });

    expect(result).toBeUndefined();
    expect(once.warn).toHaveBeenCalledWith(expect.stringContaining('@typescript/typescript6'));
  });

  it('resolves to undefined without warning when TypeScript is not installed', async () => {
    const result = await loadTypeScriptCompilerApi({ typescript: missing, typescript6: missing });

    expect(result).toBeUndefined();
    expect(once.warn).not.toHaveBeenCalled();
  });
});
