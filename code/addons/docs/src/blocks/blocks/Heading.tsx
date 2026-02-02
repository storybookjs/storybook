import type { FC, PropsWithChildren } from 'react';
import React from 'react';

import { H2 } from 'storybook/internal/components';

import GithubSlugger from 'github-slugger';

import { HeaderMdx } from './mdx';

export interface HeadingProps {
  disableAnchor?: boolean;
}

export const slugs = new GithubSlugger();

export const Heading: FC<PropsWithChildren<HeadingProps>> = ({
  children,
  disableAnchor,
  ...props
}) => {
  if (disableAnchor || typeof children !== 'string') {
    return <H2>{children}</H2>;
  }

  const tagID = slugs.slug(children.toLowerCase());

  return (
    <HeaderMdx as="h2" id={tagID} {...props} style={{ display: 'flex', alignItems: 'center' }}>
      {/* Accessible anchor link */}
      <a
        href={`#${tagID}`}
        className="anchor"
        tabIndex={0}
        aria-label={`Link to heading ${children}`}
        style={{ marginRight: '0.5rem', textDecoration: 'none' }}
      >
        <span aria-hidden="true">#</span>
      </a>
      {children}
    </HeaderMdx>
  );
};
