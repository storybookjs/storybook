import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';

const DynamicComponent = dynamic(() => import('./dynamic-component'), {
  ssr: false,
});

function Component() {
  return (
    <Suspense fallback="Loading...">
      <DynamicComponent />
    </Suspense>
  );
}

export default {
  component: Component,
};

export const Default = {};
