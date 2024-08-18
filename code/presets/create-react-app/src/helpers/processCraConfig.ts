/* eslint-disable @typescript-eslint/naming-convention */
import { resolve } from 'node:path';

import type { PluginItem, TransformOptions } from '@babel/core';
import semver from 'semver';
import type { Configuration, RuleSetCondition, RuleSetRule } from 'webpack';

import type { PluginOptions } from '../types';

type RuleSetConditions = RuleSetCondition[];

const isRegExp = (value: RegExp | unknown): value is RegExp => value instanceof RegExp;

const isString = (value: string | unknown): value is string => typeof value === 'string';

// This handles arrays in Webpack rule tests.
const testMatch = (rule: RuleSetRule, string: string): boolean => {
  if (!rule.test) {
    return false;
  }
  return Array.isArray(rule.test)
    ? rule.test.some((test) => isRegExp(test) && test.test(string))
    : isRegExp(rule.test) && rule.test.test(string);
};

export const processCraConfig = async (
  craWebpackConfig: Configuration,
  options: PluginOptions
): Promise<RuleSetRule[]> => {
  const configDir = resolve(options.configDir);

  /*
   * NOTE: As of version 5.3.0 of Storybook, Storybook's default loaders are no
   * longer appended when using this preset, meaning less customisation is
   * needed when used alongside that version.
   *
   * When loaders were appended in previous Storybook versions, some CRA loaders
   * had to be disabled or modified to avoid conflicts.
   *
   * See: https://github.com/storybookjs/storybook/pull/9157
   */
  const storybookVersion = semver.coerce(options.packageJson.version) || '';
  const isStorybook530 = semver.gte(storybookVersion, '5.3.0');
  const babelOptions = await options.presets.apply('babel');

  if (!craWebpackConfig?.module?.rules) {
    return [];
  }

  return craWebpackConfig.module.rules.reduce((rules, rule): RuleSetRule[] => {
    const { oneOf, include } = rule as RuleSetRule;

    // Add our `configDir` to support JSX and TypeScript in that folder.
    if (testMatch(rule as RuleSetRule, '.jsx')) {
      const newRule = {
        ...(rule as RuleSetRule),
        include: [include as string, configDir].filter(Boolean),
      };
      return [...rules, newRule];
    }

    /*
     * CRA makes use of Webpack's `oneOf` feature.
     * https://webpack.js.org/configuration/module/#ruleoneof
     *
     * Here, we map over those rules and add our `configDir` as above.
     */
    if (oneOf) {
      return [
        ...rules,
        {
          // @ts-expect-error (broken typings from webpack)
          oneOf: oneOf.map((oneOfRule: RuleSetRule): RuleSetRule => {
            if (oneOfRule.type === 'asset/resource') {
              if (isStorybook530) {
                const excludes = [
                  'ejs', // Used within Storybook.
                  'md', // Used with Storybook Notes.
                  'mdx', // Used with Storybook Docs.
                  'cjs', // Used for CommonJS modules.
                  ...(options.craOverrides?.fileLoaderExcludes || []),
                ];
                const excludeRegex = new RegExp(`\\.(${excludes.join('|')})$`);
                return {
                  ...oneOfRule,

                  exclude: [...(oneOfRule.exclude as RuleSetConditions), excludeRegex],
                };
              }
              return {};
            }

            // This rule causes conflicts with Storybook addons like `addon-info`.
            if (testMatch(oneOfRule, '.css')) {
              return {
                ...oneOfRule,
                include: isStorybook530 ? undefined : [configDir],
                exclude: [oneOfRule.exclude as RegExp, /@storybook/],
              };
            }

            // Used for the next two rules modifications.
            const isBabelLoader =
              isString(oneOfRule.loader) && /[/\\]babel-loader[/\\]/.test(oneOfRule.loader);

            // Target `babel-loader` and add user's Babel config.
            if (isBabelLoader && isRegExp(oneOfRule.test) && oneOfRule.test.test('.jsx')) {
              const { include: _include, options: ruleOptions } = oneOfRule;

              const {
                plugins: rulePlugins,
                presets: rulePresets,
                overrides: ruleOverrides,
              } = (typeof ruleOptions === 'object' ? ruleOptions : {}) as {
                plugins: PluginItem[] | null;
                presets: PluginItem[] | null;
                overrides: TransformOptions[] | null;
              };

              const { extends: _extends, plugins, presets, overrides } = babelOptions;

              return {
                ...oneOfRule,
                include: [_include as string, configDir].filter(Boolean),
                options: {
                  ...(ruleOptions as Record<string, unknown>),
                  extends: _extends,
                  plugins: [...(plugins ?? []), ...(rulePlugins ?? [])],
                  presets: [...(presets ?? []), ...(rulePresets ?? [])],
                  overrides: [...(overrides ?? []), ...(ruleOverrides ?? [])],
                },
              };
            }

            // Target `babel-loader` that processes `node_modules`, and add Storybook config dir.
            if (isBabelLoader && isRegExp(oneOfRule.test) && oneOfRule.test.test('.js')) {
              return {
                ...oneOfRule,
                include: [configDir],
              };
            }

            return oneOfRule;
          }),
        },
      ];
    }

    return [...rules, rule as RuleSetRule];
  }, [] as RuleSetRule[]);
};
