import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BuilderDocgenPackagesMissingError } from 'storybook/internal/server-errors';

import {
  isReactBuilderDocgenPackageInstalled,
  prepareReactBuilderDocgen,
} from '@storybook/react/internal/builder-docgen';
import ReactDocgenTypescriptPlugin from '@storybook/react-docgen-typescript-plugin';

import type { Configuration } from 'webpack';

import * as preset from './framework-preset-react-docs.ts';

vi.mock('@storybook/react/internal/builder-docgen', { spy: true });

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

const missingPackagesError = new BuilderDocgenPackagesMissingError({
  builderDocgen: "typescript.reactDocgen: 'react-docgen'",
  disableBuilderDocgen: 'typescript.reactDocgen: false',
  documentation: 'https://storybook.js.org/docs/api/main-config/main-config-typescript#reactdocgen',
  packages: ['react-docgen'],
  installCommand: 'npm install -D "react-docgen@^8.0.2"',
  docgenServerDisabledInMainConfig: true,
  typescriptUsable: true,
});

describe('framework-preset-react-docs', () => {
  beforeEach(() => {
    vi.mocked(isReactBuilderDocgenPackageInstalled).mockReturnValue(true);
  });

  it('leaves the config alone on the docgen server', async () => {
    const config = await run({ reactDocgen: 'react-docgen' }, { docgenServer: true });

    expect(config).toEqual({ plugins: [] });
    expect(prepareReactBuilderDocgen).not.toHaveBeenCalled();
  });

  it('leaves the config alone when docgen is disabled', async () => {
    await expect(run({ reactDocgen: false })).resolves.toEqual({ plugins: [] });
  });

  describe('in react-docgen mode', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue('react-docgen');
    });

    it('adds the react-docgen loader for every file', async () => {
      const config = await run({ reactDocgen: 'react-docgen' });

      expect(config?.module?.rules).toEqual([docgenLoaderRule(/\.(cjs|mjs|tsx?|jsx?)$/)]);
      expect(prepareReactBuilderDocgen).toHaveBeenCalledWith(
        expect.objectContaining({ reactDocgen: 'react-docgen', builder: 'webpack' })
      );
    });
  });

  describe('in react-docgen-typescript mode', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue('react-docgen-typescript');
    });

    it('adds the react-docgen-typescript plugin, and react-docgen for JavaScript files', async () => {
      const config = await run({ reactDocgen: 'react-docgen-typescript' });

      expect(config?.plugins).toEqual([expect.any(ReactDocgenTypescriptPlugin)]);
      expect(config?.module?.rules).toEqual([docgenLoaderRule(/\.(cjs|mjs|jsx?)$/)]);
    });

    describe('without react-docgen', () => {
      beforeEach(() => {
        vi.mocked(isReactBuilderDocgenPackageInstalled).mockReturnValue(false);
      });

      it('skips the JavaScript pass', async () => {
        const config = await run({ reactDocgen: 'react-docgen-typescript' });

        expect(config?.plugins).toEqual([expect.any(ReactDocgenTypescriptPlugin)]);
        expect(config?.module?.rules).toEqual([]);
      });
    });
  });

  describe('when builder docgen must not run', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue(undefined);
    });

    it('leaves the config alone', async () => {
      await expect(run({ reactDocgen: 'react-docgen' })).resolves.toEqual({ plugins: [] });
    });
  });

  describe('when the package check fails', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockRejectedValue(missingPackagesError);
    });

    it('fails with its error', async () => {
      await expect(run({ reactDocgen: 'react-docgen' })).rejects.toBe(missingPackagesError);
    });
  });
});
