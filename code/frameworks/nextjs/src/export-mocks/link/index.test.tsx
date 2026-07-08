import { describe, expect, it, vi } from 'vitest';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MockLink from './index.tsx';

const renderHref = (props: Record<string, unknown>) => {
  const html = renderToStaticMarkup(React.createElement(MockLink, props, 'User'));
  return /href="([^"]*)"/.exec(html)?.[1];
};

const makeClickEvent = () => {
  const e = {
    defaultPrevented: false,
    preventDefault() {
      e.defaultPrevented = true;
    },
  };
  return e as unknown as React.MouseEvent<HTMLAnchorElement>;
};

const getAnchorOnClick = (props: Record<string, unknown>) =>
  (MockLink as any).render(props, null).props.onClick as (
    e: React.MouseEvent<HTMLAnchorElement>
  ) => void;

describe('next/link mock', () => {
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

  it('calls onClick before preventing default', () => {
    let defaultPreventedWhenHandlerRan: boolean | undefined;
    const onClick = vi.fn((e: React.MouseEvent<HTMLAnchorElement>) => {
      defaultPreventedWhenHandlerRan = e.defaultPrevented;
    });

    getAnchorOnClick({ href: '/about', onClick })(makeClickEvent());

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(defaultPreventedWhenHandlerRan).toBe(false);
  });

  it('still runs a handler that bails when the event was already default-prevented', () => {
    const userOnClick = vi.fn();
    const mergedOnClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented) {
        return;
      }
      userOnClick();
    };

    getAnchorOnClick({ href: '/about', onClick: mergedOnClick })(makeClickEvent());

    expect(userOnClick).toHaveBeenCalledTimes(1);
  });
});
