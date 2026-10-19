import { describe, expect, it } from 'vitest';

import {
  aliasReactInWebpack,
  prependReactDedupePlugin,
  reactDedupeVitePlugin,
  reactResolveAlias,
} from './preview-react-alias.ts';

const target = { react: '/app/react', reactDom: '/app/react-dom' };

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

  it('prepends the vite plugin so a later plugin can replace the alias', () => {
    const later = { name: 'later' };
    const config = prependReactDedupePlugin({ plugins: [later] }, target);
    expect(config.plugins?.[0]).toMatchObject({ name: 'storybook:react-dedupe', enforce: 'pre' });
    expect(config.plugins?.[1]).toBe(later);
  });

  it('exposes the alias through the vite plugin config hook', () => {
    expect(reactDedupeVitePlugin(target).config().resolve.alias).toEqual(reactResolveAlias(target));
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
