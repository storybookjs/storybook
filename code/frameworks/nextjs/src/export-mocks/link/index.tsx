import React from 'react';

import { fn } from 'storybook/test';

const linkAction = fn().mockName('next/link::Link');

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
  const hrefString =
    typeof resolvedHref === 'object'
      ? `${resolvedHref.pathname || ''}${resolvedHref.query ? '?' + new URLSearchParams(resolvedHref.query).toString() : ''}${resolvedHref.hash || ''}`
      : resolvedHref;

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
