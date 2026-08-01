import type { ComponentProps } from 'react';
import React, { Suspense, lazy } from 'react';

const LazyWithTooltip = lazy(() =>
  import('./WithTooltip.tsx').then((mod) => ({ default: mod.WithTooltip }))
);

export const WithTooltip = (props: ComponentProps<typeof LazyWithTooltip>): React.JSX.Element => (
  <Suspense fallback={<div />}>
    <LazyWithTooltip {...props} />
  </Suspense>
);

const LazyWithTooltipPure = lazy(() =>
  import('./WithTooltip.tsx').then((mod) => ({ default: mod.WithTooltipPure }))
);

export const WithTooltipPure = (
  props: ComponentProps<typeof LazyWithTooltipPure>
): React.JSX.Element => (
  <Suspense fallback={<div />}>
    <LazyWithTooltipPure {...props} />
  </Suspense>
);
