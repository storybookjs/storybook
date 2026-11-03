import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkReactBuilderDocgenPackages,
  getTypeScriptForDocgenError,
  isBuilderDocgenPackageInstalled,
} from 'storybook/internal/common';
import {
  BuilderDocgenPackagesMissingError,
  TypeScriptWithoutCompilerApiError,
} from 'storybook/internal/server-errors';

import ReactDocgenTypescriptPlugin from '@storybook/react-docgen-typescript-plugin';

import type { Configuration } from 'webpack';

import * as preset from './framework-preset-react-docs.ts';

vi.mock('storybook/internal/common', { spy: true });

const run = (typescript: Record<string, unknown>, features = { docgenServer: false }) =>
  preset.webpackFinal?.(
    { plugins: [] } as Configuration,
    {
      configDir: '/project/.storybook',
      presets: {
        apply: async (name: string) =>
          name === 'typescript' ? typescript : name === 'features' ? features : undefined,
      },
    } as any
  );

const docgenLoaderRule = (test: RegExp) =>
  expect.objectContaining({
    test,
    enforce: 'pre',
    loader: expect.stringContaining('react-docgen-loader'),
  });

describe('framework-preset-react-docs', () => {
  beforeEach(() => {
    vi.mocked(checkReactBuilderDocgenPackages).mockResolvedValue([]);
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(undefined);
    vi.mocked(isBuilderDocgenPackageInstalled).mockReturnValue(true);
  });

  it('leaves the config alone on the docgen server', async () => {
    const config = await run({ reactDocgen: 'react-docgen' }, { docgenServer: true });

    expect(config).toEqual({ plugins: [] });
    expect(checkReactBuilderDocgenPackages).not.toHaveBeenCalled();
  });

  it('leaves the config alone when docgen is disabled', async () => {
    await expect(run({ reactDocgen: false })).resolves.toEqual({ plugins: [] });
  });

  it('adds the react-docgen loader for every file', async () => {
    const config = await run({ reactDocgen: 'react-docgen' });

    expect(config?.module?.rules).toEqual([docgenLoaderRule(/\.(cjs|mjs|tsx?|jsx?)$/)]);
    expect(checkReactBuilderDocgenPackages).toHaveBeenCalledWith(
      expect.objectContaining({ packages: ['react-docgen'] })
    );
  });

  it('adds the react-docgen-typescript plugin, and react-docgen for JavaScript files', async () => {
    const config = await run({ reactDocgen: 'react-docgen-typescript' });

    expect(config?.plugins).toEqual([expect.any(ReactDocgenTypescriptPlugin)]);
    expect(config?.module?.rules).toEqual([docgenLoaderRule(/\.(cjs|mjs|jsx?)$/)]);
    expect(checkReactBuilderDocgenPackages).toHaveBeenCalledWith(
      expect.objectContaining({
        packages: ['@storybook/react-docgen-typescript-plugin', 'react-docgen-typescript'],
      })
    );
  });

  it('skips the JavaScript pass in react-docgen-typescript mode without react-docgen', async () => {
    vi.mocked(isBuilderDocgenPackageInstalled).mockReturnValue(false);

    const config = await run({ reactDocgen: 'react-docgen-typescript' });

    expect(config?.plugins).toEqual([expect.any(ReactDocgenTypescriptPlugin)]);
    expect(config?.module?.rules).toEqual([]);
  });

  it('uses react-docgen for every file without a usable typescript', async () => {
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(
      new TypeScriptWithoutCompilerApiError({ version: '7.0.2' })
    );

    const config = await run({ reactDocgen: 'react-docgen-typescript' });

    expect(config?.plugins).toEqual([]);
    expect(config?.module?.rules).toEqual([docgenLoaderRule(/\.(cjs|mjs|tsx?|jsx?)$/)]);
  });

  it('leaves the config alone when packages are missing', async () => {
    vi.mocked(checkReactBuilderDocgenPackages).mockResolvedValue(['react-docgen']);

    await expect(run({ reactDocgen: 'react-docgen' })).resolves.toEqual({ plugins: [] });
  });

  it('fails with the error from the package check', async () => {
    const error = new BuilderDocgenPackagesMissingError({
      reactDocgen: 'react-docgen',
      packages: ['react-docgen'],
      installCommand: 'npm install -D "react-docgen@^8.0.2"',
      docgenServerDisabledInMainConfig: true,
      typescriptUsable: true,
    });
    vi.mocked(checkReactBuilderDocgenPackages).mockRejectedValue(error);

    await expect(run({ reactDocgen: 'react-docgen' })).rejects.toBe(error);
  });
});
