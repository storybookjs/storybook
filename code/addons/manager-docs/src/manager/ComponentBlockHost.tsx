import React, { useLayoutEffect, useRef } from 'react';

import { COMPONENT_BLOCK_TAG } from '../constants.ts';
import type { Block, ComponentProps } from '../parser/types.ts';

type BlockHostElement = HTMLElement & {
  blockProps?: ComponentProps;
  blockText?: string;
};

export type ComponentBlock = Extract<Block, { type: 'component' }>;

// The component mounts in this host's shadow root from a separate bundle with the project's renderer.
export function ComponentBlockHost({ block }: { block: ComponentBlock }) {
  const ref = useRef<BlockHostElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.blockText = block.children;
    element.blockProps = block.props;
  }, [block.props, block.children]);
  return React.createElement(COMPONENT_BLOCK_TAG, {
    key: block.blockId,
    ref,
    'data-block-id': block.blockId,
    style: { display: 'block', margin: '16px 0' },
  });
}
