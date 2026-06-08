import React from 'react';

export const WhereSelector = ({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props} className={['textLink', className].filter(Boolean).join(' ')} />
);
