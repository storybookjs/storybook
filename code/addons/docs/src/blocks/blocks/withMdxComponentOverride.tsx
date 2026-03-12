import type { ComponentType } from 'react';
import React from 'react';

import { useMDXComponents } from '@mdx-js/react';

// Imported MDX doc blocks bypass MDXProvider in MDX2+, so this restores `docs.components` overrides.
export const withMdxComponentOverride = <P extends object>(
  blockName: string,
  Block: ComponentType<P>
): ComponentType<P> => {
  const WrappedBlock = (props: P) => {
    const components = useMDXComponents();
    const Override = components[blockName] as ComponentType<P> | undefined;

    if (Override && Override !== WrappedBlock) {
      return <Override {...props} />;
    }

    return <Block {...props} />;
  };

  WrappedBlock.displayName = blockName;

  return WrappedBlock;
};
