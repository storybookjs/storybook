import type { FC, PropsWithChildren } from 'react';
import React from 'react';

import { H3 } from 'storybook/internal/components';

import type { HeadingProps } from './Heading';
import { slugs } from './Heading';
import { DocsSluggerContext } from './DocsSluggerContext';
import { HeaderMdx } from './mdx';
import { withMdxComponentOverride } from './with-mdx-component-override';

const SubheadingImpl: FC<PropsWithChildren<HeadingProps>> = ({ children, disableAnchor }) => {
  const slugger = React.useContext(DocsSluggerContext) ?? slugs;
  const text = typeof children === 'string' ? children : undefined;
  // See `Heading`: re-rendering the docs tree must not consume another slug.
  const tagID = React.useMemo(
    () => (disableAnchor || text === undefined ? undefined : slugger.slug(text.toLowerCase())),
    [disableAnchor, slugger, text]
  );

  if (tagID === undefined) {
    return <H3>{children}</H3>;
  }
  return (
    <HeaderMdx as="h3" id={tagID}>
      {children}
    </HeaderMdx>
  );
};

export const Subheading = withMdxComponentOverride('Subheading', SubheadingImpl);
