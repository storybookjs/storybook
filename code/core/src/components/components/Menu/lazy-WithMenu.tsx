import type { ComponentProps } from 'react';
import React, { Suspense, lazy } from 'react';

const LazyWithMenu = lazy(() => import('./WithMenu').then((mod) => ({ default: mod.WithMenu })));

export const WithMenu = (props: ComponentProps<typeof LazyWithMenu>) => (
  <Suspense fallback={<div />}>
    <LazyWithMenu {...props} />
  </Suspense>
);
