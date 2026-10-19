import { describe, expect, it } from 'vitest';

import { mergeConfig } from 'vite';

import {
  aliasReactInWebpack,
  prependReactDedupePlugin,
  reactDedupeVitePlugin,
  reactResolveAlias,
  reactViteAlias,
} from './preview-react-alias.ts';

const target = { react: '/app/react', reactDom: '/app/react-dom' };

type AliasEntry = { find: string | RegExp; replacement: string };

// Same matching as Vite's alias plugin: entries are tried in order, a string key also matches its subpaths.
const applyAlias = (alias: AliasEntry[], importee: string) => {
  const entry = alias.find(({ find }) =>
    typeof find === 'string'
      ? importee === find || importee.startsWith(`${find}/`)
      : find.test(importee)
  );
  return entry ? importee.replace(entry.find, entry.replacement) : importee;
};

describe('react preview alias', () => {
  it('points react and react-dom at absolute directories', () => {
    expect(reactResolveAlias(target)).toEqual({
      react: '/app/react',
      'react-dom/server': '/app/react-dom/server.browser.js',
      'react-dom': '/app/react-dom',
    });
  });

  it('leaves react-dom/server unset when react-dom is a package name', () => {
    expect(reactResolveAlias({ react: 'preact/compat', reactDom: 'preact/compat' })).toEqual({
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    });
  });

  it('rewrites react, react-dom and their subpaths in vite', () => {
    const alias = reactViteAlias(target);
    expect(applyAlias(alias, 'react')).toBe('/app/react');
    expect(applyAlias(alias, 'react/jsx-runtime')).toBe('/app/react/jsx-runtime');
    expect(applyAlias(alias, 'react-dom')).toBe('/app/react-dom');
    expect(applyAlias(alias, 'react-dom/client')).toBe('/app/react-dom/client');
    expect(applyAlias(alias, 'react-dom/server')).toBe('/app/react-dom/server.browser.js');
    expect(applyAlias(alias, 'react-redux')).toBe('react-redux');
  });

  it('lets a later object alias from Next.js win for every entry it declares', () => {
    const nextAlias = {
      'react/jsx-runtime': '/next/compiled/react/jsx-runtime.js',
      react: '/next/compiled/react/index.js',
      'react-dom/client': '/next/compiled/react-dom/client.js',
      'react-dom': '/next/compiled/react-dom/index.js',
    };
    const merged = mergeConfig(reactDedupeVitePlugin(target).config(), {
      resolve: { alias: nextAlias },
    });
    const alias = merged.resolve.alias as AliasEntry[];
    expect(applyAlias(alias, 'react')).toBe('/next/compiled/react/index.js');
    expect(applyAlias(alias, 'react/jsx-runtime')).toBe('/next/compiled/react/jsx-runtime.js');
    expect(applyAlias(alias, 'react-dom/client')).toBe('/next/compiled/react-dom/client.js');
  });

  it('prepends the vite plugin so a later plugin can replace the alias', () => {
    const later = { name: 'later' };
    const config = prependReactDedupePlugin({ plugins: [later] }, target);
    expect(config.plugins?.[0]).toMatchObject({ name: 'storybook:react-dedupe', enforce: 'pre' });
    expect(config.plugins?.[1]).toBe(later);
  });

  it('exposes the alias through the vite plugin config hook', () => {
    expect(reactDedupeVitePlugin(target).config().resolve.alias).toEqual(reactViteAlias(target));
  });

  it('sets the webpack alias without dropping an existing entry', () => {
    expect(
      aliasReactInWebpack({ resolve: { alias: { vue: '/vue' } } }, target).resolve?.alias
    ).toEqual({
      vue: '/vue',
      ...reactResolveAlias(target),
    });
  });
});
