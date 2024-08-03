import type { FC } from 'react';
import React, { useContext } from 'react';
import type { BaseAnnotations, ModuleExports } from 'storybook/internal/types';

import { Anchor } from './Anchor';
import { DocsContext } from './DocsContext';

type MetaProps = BaseAnnotations & { of?: ModuleExports; title?: string };

/**
 * This component is used to declare component metadata in docs
 * and gets transformed into a default export underneath the hood.
 */
export const Meta: FC<MetaProps> = ({ of }) => {
  const context = useContext(DocsContext);
  if (of) {
    context.referenceMeta(of, true);
  }

  try {
    const primary = context.storyById();
    return <Anchor storyId={primary.id} />;
  } catch (err) {
    // It is possible to use <Meta> in a unnattached MDX file
    return null;
  }
};
