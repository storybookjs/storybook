import React from 'react';

import type { ArgsStoryFn } from 'storybook/internal/types';

import type { ReactRenderer } from './types';

export const render: ArgsStoryFn<ReactRenderer> = (args, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  return <Component {...args} />;
};
