import React from 'react';

import { fn } from 'storybook/test';

const linkAction = fn().mockName('next/link::Link');

const MockLink = React.forwardRef<HTMLAnchorElement, any>(function MockLink(
  {
    href,
    as: _as,
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
  const hrefString =
    typeof href === 'object'
      ? `${href.pathname || ''}${href.query ? '?' + new URLSearchParams(href.query).toString() : ''}${href.hash || ''}`
      : href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick?.(e);
    linkAction(hrefString, { replace, scroll, shallow, prefetch, locale });
  };

  return (
    <a ref={ref} href={hrefString} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
});

MockLink.displayName = 'NextLink';

export default MockLink;
export { MockLink as Link };
