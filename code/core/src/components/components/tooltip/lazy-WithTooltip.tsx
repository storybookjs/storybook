import type { ComponentProps } from 'react';
import React, { Suspense, lazy } from 'react';

const LazyWithTooltip = lazy(() =>
  import('./WithTooltip').then((mod) => ({ default: mod.WithTooltip }))
);

export const WithTooltip = (props: ComponentProps<typeof LazyWithTooltip>) => (
  <Suspense fallback={<div />}>
    <LazyWithTooltip {...props} />
  </Suspense>
);
