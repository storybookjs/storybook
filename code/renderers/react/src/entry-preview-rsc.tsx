import * as React from 'react';

import type { Addon_DecoratorFunction } from 'storybook/internal/types';

import semver from 'semver';

import type { StoryContext } from './types';

export const ServerComponentDecorator = (
  Story: React.FC,
  { parameters }: StoryContext
): React.ReactNode => {
  if (!parameters?.react?.rsc) return <Story />;

  const major = semver.major(React.version);
  const minor = semver.minor(React.version);
  if (major < 18 || (major === 18 && minor < 3)) {
    throw new Error('React Server Components require React >= 18.3');
  }

  return (
    <React.Suspense>
      <Story />
    </React.Suspense>
  );
};

export const decorators: Addon_DecoratorFunction<any>[] = [ServerComponentDecorator];

export const parameters = {
  react: {
    rsc: true,
  },
};
