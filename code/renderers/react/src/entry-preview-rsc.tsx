import * as React from 'react';
import semver from 'semver';
import type { Addon_DecoratorFunction } from '@storybook/types';

export const ServerComponentDecorator: Addon_DecoratorFunction = (story, { parameters }) => {
  if (!parameters?.react?.rsc) return story();

  const major = semver.major(React.version);
  const minor = semver.minor(React.version);
  if (major < 18 || (major === 18 && minor < 3)) {
    throw new Error('React Server Components require React >= 18.3');
  }

  return <React.Suspense>{story() as React.ReactNode}</React.Suspense>;
};

export const decorators = [ServerComponentDecorator];

export const parameters = {
  react: {
    rsc: true,
  },
};
