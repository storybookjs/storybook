import type { ComponentProps } from 'react';
import React, { lazy, Suspense } from 'react';
import type { ColorControlProps } from './Color';

export * from './types';

export * from './Boolean';

export type ColorProps = ColorControlProps;

const LazyColorControl = lazy(() => import('./Color'));

export const ColorControl = (props: ComponentProps<typeof LazyColorControl>) => (
  <Suspense fallback={<div />}>
    <LazyColorControl {...props} />
  </Suspense>
);

export * from './Date';

export * from './Number';

export * from './options';
export * from './Object';

export * from './Range';

export * from './Text';

export * from './Files';
