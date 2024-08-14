import * as React from 'react';

import semver from 'semver';

import type { Decorator } from './public-types';

export const parameters = { renderer: 'react' };
export { render } from './render';
export { renderToCanvas } from './renderToCanvas';
export { mount } from './mount';

export const decorators: Decorator[] = [
  (Story, context) => {
    if (!context.parameters?.react?.rsc) return <Story />;

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
  },
];
