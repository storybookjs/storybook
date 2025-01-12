import { expect, it } from 'vitest';

import { getHasRouterPackage } from './get-has-router-package';

it('returns true if there is a routing package in package.json', () => {
  expect(
    getHasRouterPackage({
      dependencies: {
        react: '^18',
        'react-dom': '^18',
        'react-router': '^6',
      },
    })
  ).toBe(true);
});

it('returns false if there is a routing package in package.json dependencies', () => {
  expect(
    getHasRouterPackage({
      dependencies: {
        react: '^18',
        'react-dom': '^18',
      },
      devDependencies: {
        'react-router': '^6',
      },
    })
  ).toBe(false);
});
