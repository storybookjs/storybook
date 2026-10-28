import type { ComponentProps } from 'react';
import React, { Suspense, lazy } from 'react';

import type { ColorControlProps } from './Color.tsx';

export * from './types.ts';

export * from './Boolean.tsx';

export type ColorProps = ColorControlProps;

const LazyColorControl = lazy(() => import('./Color.tsx'));

export const ColorControl = (props: ComponentProps<typeof LazyColorControl>) => (
  <Suspense fallback={<div />}>
    <LazyColorControl {...props} />
  </Suspense>
);

export * from './Date.tsx';

export * from './Number.tsx';

export * from './options/index.ts';
export * from './Object.tsx';

export * from './Range.tsx';

export * from './Text.tsx';

export * from './Files.tsx';
