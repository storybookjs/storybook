import { describe, expect, it } from 'vitest';

import MockLink from './index.tsx';

const renderHref = (props: Record<string, unknown>) =>
  (MockLink as any).render(props, null).props.href as string | undefined;

describe('next/link mock', () => {
  it('resolves a UrlObject href', () => {
    expect(renderHref({ href: { pathname: '/about', query: { ref: 'nav' } } })).toBe(
      '/about?ref=nav'
    );
  });

  it('prefixes the hash of a UrlObject href with `#`', () => {
    expect(renderHref({ href: { pathname: '/blog', query: { page: '2' }, hash: 'list' } })).toBe(
      '/blog?page=2#list'
    );
  });

  it('prefixes the hash of a hash-only UrlObject href with `#`', () => {
    expect(renderHref({ href: { hash: 'section' } })).toBe('#section');
  });

  it('does not double up a `#` already on the hash of a UrlObject href', () => {
    expect(renderHref({ href: { hash: '#x' } })).toBe('#x');
    expect(renderHref({ href: { pathname: '/blog', hash: '#list' } })).toBe('/blog#list');
  });
});
