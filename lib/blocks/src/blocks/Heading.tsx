import type { FC, PropsWithChildren } from 'react';
import React from 'react';

import { H2 } from 'storybook/internal/components';

import { HeaderMdx } from './mdx';

export interface HeadingProps {
  disableAnchor?: boolean;
}

export const Heading: FC<PropsWithChildren<HeadingProps>> = ({
  children,
  disableAnchor,
  ...props
}) => {
  if (disableAnchor || typeof children !== 'string') {
    return <H2>{children}</H2>;
  }
  const tagID = children.toLowerCase().replace(/[^a-z0-9]/gi, '-');
  return (
    <HeaderMdx as="h2" id={tagID} {...props}>
      {children}
    </HeaderMdx>
  );
};
