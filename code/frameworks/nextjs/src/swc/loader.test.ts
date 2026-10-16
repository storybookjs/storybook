import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import type { NextConfig } from 'next';
import type { Configuration, RuleSetRule, RuleSetUseFunction } from 'webpack';

import { configureSWCLoader } from './loader.ts';

vi.mock('storybook/internal/common', () => ({
  getProjectRoot: () => '/project-root',
}));

vi.mock('@storybook/builder-webpack5', () => ({
  getVirtualModules: async () => ({ virtualModules: {} }),
}));

vi.mock('next/dist/build/load-jsconfig.js', () => ({
  default: async () => ({ jsConfig: {} }),
}));

const options = { configType: 'DEVELOPMENT' } as Options;

const optimizePackageImportsConfig: NextConfig = {
  experimental: { optimizePackageImports: ['@/shared'] },
};

const barrelOptimizeRuleTest = /__barrel_optimize__/;

async function getRules(nextConfig: NextConfig) {
  const baseConfig: Configuration = { module: { rules: [] } };

  await configureSWCLoader(baseConfig, options, nextConfig);

  return baseConfig.module!.rules as RuleSetRule[];
}

function getBarrelRule(rules: RuleSetRule[]) {
  return rules.find((rule) => rule.test?.toString() === barrelOptimizeRuleTest.toString());
}

/**
 * `swc` implements `optimizePackageImports` by rewriting named imports of the configured packages
 * into requests such as `__barrel_optimize__?names=a!=!@/shared`. webpack matches the rules of
 * those requests against the part before `!=!`, so this is the `resourceQuery` that the rule of
 * the barrel loader sees.
 */
function getUse(rule: RuleSetRule, resourceQuery: string): ReturnType<RuleSetUseFunction> {
  const { use } = rule;

  if (typeof use !== 'function') {
    throw new Error('expected the barrel loader rule to resolve its loaders from the request');
  }

  // webpack calls a `use` callback with the data of the effect it is matching. Only
  // `resourceQuery` is read, the other properties are the ones webpack requires.
  const effectData: Parameters<RuleSetUseFunction>[0] = {
    dependency: '',
    issuer: '',
    issuerLayer: '',
    resourceQuery,
  };

  return use(effectData);
}

describe('configureSWCLoader', () => {
  it('registers the Next.js barrel loader for the requests created by `optimizePackageImports`', async () => {
    const rules = await getRules(optimizePackageImportsConfig);
    const barrelRule = getBarrelRule(rules);

    expect(barrelRule).toBeDefined();
    // The barrel loader emits code that might need further transformation, so Next.js
    // registers its rule before all other rules as well.
    expect(rules[0]).toBe(barrelRule);

    const use = getUse(barrelRule!, '?names=a');

    expect(use).toHaveLength(1);
    expect(use).toMatchObject([
      {
        loader: expect.stringContaining('next-barrel-loader'),
        options: {
          names: ['a'],
          swcCacheDir: join('/project-root', '.next', 'cache', 'swc'),
        },
        // The names have to be part of the ident, otherwise importers of different
        // exports of the same barrel file would share a module.
        ident: 'next-barrel-loader:?names=a',
      },
    ]);
  });

  it('uses the export names of the request as the barrel loader `names` option', async () => {
    const barrelRule = getBarrelRule(await getRules(optimizePackageImportsConfig))!;

    expect(getUse(barrelRule, '?names=a,b')).toMatchObject([
      {
        options: {
          names: ['a', 'b'],
          swcCacheDir: join('/project-root', '.next', 'cache', 'swc'),
        },
      },
    ]);
    // The barrel loader emits `__barrel_optimize__?names=a&wildcard!=!…` requests itself.
    expect(getUse(barrelRule, '?names=a&wildcard')).toMatchObject([
      { options: { names: ['a'] } },
    ]);
  });

  it('does not register a barrel loader rule without `optimizePackageImports`', async () => {
    expect(getBarrelRule(await getRules({}))).toBeUndefined();
  });
});
