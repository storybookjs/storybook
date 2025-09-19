import type { ComponentProps } from 'react';
import React, { Suspense, lazy } from 'react';

const LazyWithPopover = lazy(() =>
  import('./WithPopover').then((mod) => ({ default: mod.WithPopover }))
);

export const WithPopover = (props: ComponentProps<typeof LazyWithPopover>) => (
  <Suspense fallback={<div />}>
    <LazyWithPopover {...props} />
  </Suspense>
);
