import type { ComponentType } from 'react';
import React from 'react';

import { useMDXComponents } from '@mdx-js/react';

const MDX_WRAPPED_BLOCK = Symbol('mdxWrappedBlock');
const MdxWrappedBlockContext = React.createContext<Set<string> | null>(null);

type WrappedBlockComponent<P extends object> = ComponentType<P> & {
  [MDX_WRAPPED_BLOCK]?: true;
};

// Imported MDX doc blocks bypass MDXProvider in MDX2+, so this restores `docs.components` overrides.
export const withMdxComponentOverride = <P extends object>(
  blockName: string,
  Block: ComponentType<P>
): ComponentType<P> => {
  const WrappedBlock = (props: P) => {
    // Some overrides intentionally compose with the public block export, e.g.
    // `components.Title = (props) => <Title {...props} />`. Track which wrapped blocks are already
    // being resolved so those recursive re-entries render the underlying block instead of looping
    // back through the MDX override lookup forever.
    const wrappedBlocks = React.useContext(MdxWrappedBlockContext);
    const components = useMDXComponents();
    const Override = components[blockName] as WrappedBlockComponent<P> | undefined;

    if (
      wrappedBlocks?.has(blockName) ||
      Override === WrappedBlock ||
      (typeof Override === 'function' && Override[MDX_WRAPPED_BLOCK])
    ) {
      return <Block {...props} />;
    }

    if (Override) {
      const nextWrappedBlocks = new Set(wrappedBlocks ?? []);
      nextWrappedBlocks.add(blockName);

      return (
        <MdxWrappedBlockContext.Provider value={nextWrappedBlocks}>
          <Override {...props} />
        </MdxWrappedBlockContext.Provider>
      );
    }

    return <Block {...props} />;
  };

  WrappedBlock.displayName = blockName;
  (WrappedBlock as WrappedBlockComponent<P>)[MDX_WRAPPED_BLOCK] = true;

  return WrappedBlock;
};
