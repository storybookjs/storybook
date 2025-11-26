import React from 'react';

export const Link = ({
  href: input = '',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const isStorybookPath = /^\//.test(input);
  const href = isStorybookPath ? `./?path=${input}` : input;

  const isAnchorUrl = /^#.*/.test(input);
  const target = isAnchorUrl ? '_self' : '_top';

  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a href={href} target={target} {...props} />;
};
