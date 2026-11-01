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
  const slugger = React.useContext(DocsSluggerContext) ?? slugs;
  const text = typeof children === 'string' ? children : undefined;
  // Docs pages re-render (rather than remount) on a globals change, so derive the anchor only when
  // its inputs change: slugging on every render would give the same heading a new `-1` anchor.
  const tagID = React.useMemo(
    () => (disableAnchor || text === undefined ? undefined : slugger.slug(text.toLowerCase())),
    [disableAnchor, slugger, text]
  );

  if (tagID === undefined) {
    return <H2>{children}</H2>;
  }
  return (
    <HeaderMdx as="h2" id={tagID} {...props}>
      {children}
    </HeaderMdx>
  );
};

export const Heading = withMdxComponentOverride('Heading', HeadingImpl);
