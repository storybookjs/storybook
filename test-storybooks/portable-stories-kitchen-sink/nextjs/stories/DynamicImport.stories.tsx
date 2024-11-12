import { Meta } from '@storybook/react';
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
} as Meta<typeof Component>;

export const Default = {};
