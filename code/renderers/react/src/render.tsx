import React from 'react';

import type { ArgsStoryFn } from 'storybook/internal/types';

import { wrapAsyncComponent } from './rsc/async-component.tsx';
import type { ReactRenderer } from './types.ts';

export const render: ArgsStoryFn<ReactRenderer> = (args, context) => {
  const { id, component: Component } = context;
  if (!Component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }

  // JSX written in stories goes through the framework's JSX runtime, where async server
  // components are swapped for a cached client component. This element is created with
  // `React.createElement` instead, so it has to be handled here.
  const Type = context.parameters?.react?.rsc ? wrapAsyncComponent(Component) : Component;

  return <Type {...args} />;
};
