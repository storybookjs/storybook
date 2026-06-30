import type { FC, PropsWithChildren } from 'react';
import React from 'react';

import { H2 } from 'storybook/internal/components';

import GithubSlugger from 'github-slugger';

import { DocsSluggerContext } from './DocsSluggerContext';
import { HeaderMdx } from './mdx';
import { withMdxComponentOverride } from './with-mdx-component-override';

export interface HeadingProps {
  disableAnchor?: boolean;
}

// Preserve the legacy singleton when Heading is rendered outside a Docs tree.
export const slugs = new GithubSlugger();

const HeadingImpl: FC<PropsWithChildren<HeadingProps>> = ({
  children,
  disableAnchor,
  ...props
}) => {
  if (disableAnchor || typeof children !== 'string') {
    return <H2>{children}</H2>;
  }
  const slugger = React.useContext(DocsSluggerContext) ?? slugs;
  const tagID = slugger.slug(children.toLowerCase());
  return (
    <HeaderMdx as="h2" id={tagID} {...props}>
      {children}
    </HeaderMdx>
  );
};

export const Heading = withMdxComponentOverride('Heading', HeadingImpl);
