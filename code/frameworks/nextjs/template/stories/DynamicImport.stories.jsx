import React, { Suspense } from 'react';

import dynamic from 'next/dynamic';

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
