import React from 'react';

import { fn } from 'storybook/test';

const linkAction = fn().mockName('next/link::Link');

/*
 * Mirrors next/dist/client/normalize-trailing-slash, which the real <Link> applies to
 * every href it renders. Both flags come from Next's own getDefineEnv: __NEXT_TRAILING_SLASH
 * is `trailingSlash` and __NEXT_MANUAL_TRAILING_SLASH is `skipTrailingSlashRedirect`.
 */
const removeTrailingSlash = (route: string) =>
  route.endsWith('/') && route.length > 1 ? route.slice(0, -1) : route;

const parsePath = (path: string) => {
  const hashIndex = path.indexOf('#');
  const queryIndex = path.indexOf('?');
  const hasQuery = queryIndex > -1 && (hashIndex < 0 || queryIndex < hashIndex);

  if (hasQuery || hashIndex > -1) {
    return {
      pathname: path.substring(0, hasQuery ? queryIndex : hashIndex),
      query: hasQuery ? path.substring(queryIndex, hashIndex > -1 ? hashIndex : undefined) : '',
      hash: hashIndex > -1 ? path.slice(hashIndex) : '',
    };
  }

  return { pathname: path, query: '', hash: '' };
};

const normalizePathTrailingSlash = (path: string) => {
  if (!path.startsWith('/') || process.env.__NEXT_MANUAL_TRAILING_SLASH) {
    return path;
  }

  const { pathname, query, hash } = parsePath(path);

  if (process.env.__NEXT_TRAILING_SLASH) {
    if (/\.[^/]+\/?$/.test(pathname)) {
      return `${removeTrailingSlash(pathname)}${query}${hash}`;
    }
    return `${pathname.endsWith('/') ? pathname : `${pathname}/`}${query}${hash}`;
  }

  return `${removeTrailingSlash(pathname)}${query}${hash}`;
};

const MockLink = React.forwardRef<HTMLAnchorElement, any>(function MockLink(
  {
    href,
    as,
    replace,
    scroll,
    shallow,
    prefetch,
    passHref,
    legacyBehavior,
    locale,
    onClick,
    children,
    ...rest
  },
  ref
) {
  const resolvedHref = as ?? href;
  const rawHref =
    typeof resolvedHref === 'object'
      ? `${resolvedHref.pathname || ''}${resolvedHref.query ? '?' + new URLSearchParams(resolvedHref.query).toString() : ''}${resolvedHref.hash || ''}`
      : resolvedHref;
  const hrefString = typeof rawHref === 'string' ? normalizePathTrailingSlash(rawHref) : rawHref;

  const navigate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) {
      return;
    }
    e.preventDefault();
    linkAction(hrefString, { replace, scroll, shallow, prefetch, locale });
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    navigate(e);
  };

  if (legacyBehavior) {
    const child = React.Children.only(children) as React.ReactElement<any>;
    const childProps: Record<string, any> = {
      ref,
      onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (child.props && typeof child.props.onClick === 'function') {
          child.props.onClick(e);
        }
        navigate(e);
      },
      ...rest,
    };

    if (passHref || (child.type === 'a' && !('href' in (child.props || {})))) {
      childProps.href = hrefString;
    }

    return React.cloneElement(child, childProps);
  }

  return (
    <a ref={ref} href={hrefString} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
});

MockLink.displayName = 'NextLink';

export default MockLink;
export { MockLink as Link };

export const useLinkStatus = fn((): { pending: boolean } => ({ pending: false })).mockName(
  'next/link::useLinkStatus'
);
