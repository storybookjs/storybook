import type { StoryContext } from 'storybook/internal/types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-error (this only errors during compilation for production)
import { ImageContext as ImageContextValue } from '@storybook/experimental-nextjs-rsc/dist/image-context';

// @ts-expect-error no types
import * as React from 'next/dist/compiled/react';

import { type ImageContext as ImageContextType } from '../image-context';

const ImageContext = ImageContextValue as typeof ImageContextType;

export const ImageDecorator = ({
  children,
  nextjs,
}: {
  children: React.ReactNode;
  nextjs: StoryContext['parameters']['nextjs'];
}): React.ReactNode => {
  if (!nextjs?.image) {
    return children;
  }

  return <ImageContext.Provider value={nextjs.image}>{children}</ImageContext.Provider>;
};
