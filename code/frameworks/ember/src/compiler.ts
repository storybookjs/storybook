import { getProjectRoot, resolvePathInStorybookCache } from '@storybook/core/internal/common';

import type { TransformOptions } from '@babel/core';
import emberTemplateCompiler from 'ember-source/dist/ember-template-compiler.js';

import type { EmberTemplateOptions, StorybookConfig } from './types.ts';
import { findDistFile } from './util.ts';

/** Describe the Babel and TypeScript settings the Ember Webpack rule consumes. */
export interface EmberRuleInput {
  babelOptions: TransformOptions;
  typescriptOptions: { skipCompiler?: boolean };
  /** Preview modules the rule must not compile. */
  previewModuleIds: Record<string, string>;
}

type WebpackConfig = Parameters<NonNullable<StorybookConfig['webpackFinal']>>[0];

/** Prefer the framework factory option over the `emberOptions` key of `main.ts`. */
export function pickEmberOptions(
  frameworkOptions: { emberOptions?: EmberTemplateOptions },
  main: { emberOptions?: EmberTemplateOptions }
): EmberTemplateOptions | undefined {
  return frameworkOptions.emberOptions ?? main.emberOptions;
}

/** Precompile templates, applying the configured AST polyfills. */
export function createPrecompile(
  emberOptions: EmberTemplateOptions | undefined
): (template: string, options: Record<string, unknown>) => string {
  return (template, options) =>
    emberTemplateCompiler.precompile(
      template,
      emberOptions?.polyfills ? { ...options, plugins: { ast: emberOptions.polyfills } } : options
    );
}

/** Add the Ember template and module-polyfill plugins to a Babel config. */
export function withEmberBabel(
  config: TransformOptions | undefined,
  emberOptions: EmberTemplateOptions | undefined
): TransformOptions {
  const extraPlugins = [
    [
      import.meta.resolve('babel-plugin-htmlbars-inline-precompile'),
      {
        precompile: createPrecompile(emberOptions),
        modules: {
          'ember-cli-htmlbars': 'hbs',
          'ember-cli-htmlbars-inline-precompile': 'default',
          'htmlbars-inline-precompile': 'default',
        },
      },
    ],
    [import.meta.resolve('babel-plugin-ember-modules-api-polyfill')],
  ];

  return {
    ...config,
    plugins: [...(config?.plugins ?? []), ...extraPlugins],
  };
}

/** Add the Babel rule that compiles project sources for Ember. */
export function withEmberRule(
  baseConfig: WebpackConfig,
  { babelOptions, typescriptOptions, previewModuleIds }: EmberRuleInput
): WebpackConfig {
  return {
    ...baseConfig,
    module: {
      ...baseConfig.module,
      rules: [
        ...(baseConfig.module?.rules ?? []),
        {
          test: typescriptOptions.skipCompiler ? /\.((c|m)?jsx?)$/ : /\.((c|m)?(j|t)sx?)$/,
          use: [
            {
              loader: import.meta.resolve('babel-loader'),
              options: {
                cacheDirectory: resolvePathInStorybookCache('babel'),
                ...babelOptions,
              },
            },
          ],
          include: [getProjectRoot()],
          exclude: [/node_modules/, ...Object.values(previewModuleIds)],
        },
      ],
    },
  };
}

/** Locate the preview entry that registers the Ember renderer. */
export function getEmberPreviewAnnotation(): string {
  return findDistFile(__dirname, 'client/preview/config');
}
