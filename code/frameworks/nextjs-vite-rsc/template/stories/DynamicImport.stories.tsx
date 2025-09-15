import React, { Suspense } from 'react';

import type { Meta, StoryObj } from '@storybook/nextjs-vite-rsc';

import dynamic from 'next/dynamic';

const DynamicComponent = dynamic(() => import('./DynamicImport'), {
  ssr: false,
});

function Component() {
  return (
    <Suspense fallback="Loading...">
      <DynamicComponent />
    </Suspense>
  );
}

const meta = {
  component: Component,
} satisfies Meta<typeof DynamicComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
