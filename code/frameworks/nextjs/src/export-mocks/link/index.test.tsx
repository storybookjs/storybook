import { describe, expect, it } from 'vitest';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MockLink from './index.tsx';

const renderHref = (props: Record<string, unknown>) => {
  const html = renderToStaticMarkup(React.createElement(MockLink, props, 'User'));
  return /href="([^"]*)"/.exec(html)?.[1];
};

describe('next/link mock', () => {
  // Regression for #35145: the `as` prop was destructured but never applied,
  // so the anchor showed the unresolved route template instead of the final URL.
  it('renders the resolved `as` URL instead of the `href` template when `as` is provided', () => {
    expect(renderHref({ href: '/users/[id]', as: '/users/123' })).toBe('/users/123');
  });

  it('resolves an `as` UrlObject the same way it resolves `href`', () => {
    expect(
      renderHref({ href: '/users/[id]', as: { pathname: '/users/123', query: { tab: 'x' } } })
    ).toBe('/users/123?tab=x');
  });

  it('falls back to `href` when `as` is not provided', () => {
    expect(renderHref({ href: '/about' })).toBe('/about');
    expect(renderHref({ href: { pathname: '/about', query: { ref: 'nav' } } })).toBe(
      '/about?ref=nav'
    );
  });
});
