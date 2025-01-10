import * as React from 'react';

import semver from 'semver';

import { act, getReactActEnvironment, setReactActEnvironment } from './act-compat';
import type { Decorator } from './public-types';

export const parameters = { renderer: 'react' };
export { render } from './render';
export { renderToCanvas } from './renderToCanvas';
export { mount } from './mount';

export const decorators: Decorator[] = [
  (story, context) => {
    if (!context.parameters?.react?.rsc) {
      return story();
    }

    const major = semver.major(React.version);
    const minor = semver.minor(React.version);
    if (major < 18 || (major === 18 && minor < 3)) {
      throw new Error('React Server Components require React >= 18.3');
    }

    return <React.Suspense>{story()}</React.Suspense>;
  },
];

export const beforeAll = async () => {
  try {
    // copied from
    // https://github.com/testing-library/react-testing-library/blob/3dcd8a9649e25054c0e650d95fca2317b7008576/src/pure.js
    const { configure } = await import('@storybook/test');

    configure({
      unstable_advanceTimersWrapper: (cb) => {
        return act(cb);
      },
      // For more context about why we need disable act warnings in waitFor:
      // https://github.com/reactwg/react-18/discussions/102
      asyncWrapper: async (cb) => {
        const previousActEnvironment = getReactActEnvironment();
        setReactActEnvironment(false);
        try {
          const result = await cb();
          // Drain microtask queue.
          // Otherwise we'll restore the previous act() environment, before we resolve the `waitFor` call.
          // The caller would have no chance to wrap the in-flight Promises in `act()`
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 0);

            if (jestFakeTimersAreEnabled()) {
              // @ts-expect-error global jest
              jest.advanceTimersByTime(0);
            }
          });

          return result;
        } finally {
          setReactActEnvironment(previousActEnvironment);
        }
      },
      eventWrapper: (cb) => {
        let result;
        act(() => {
          result = cb();
          return result;
        });
        return result;
      },
    });
  } catch (e) {
    // no-op
    // @storybook/test might not be available
  }
};

/** The function is used to configure jest's fake timers in environments where React's act is enabled */
function jestFakeTimersAreEnabled() {
  // @ts-expect-error global jest
  if (typeof jest !== 'undefined' && jest !== null) {
    return (
      // legacy timers

      // eslint-disable-next-line no-underscore-dangle
      (setTimeout as any)._isMockFunction === true || // modern timers
      Object.prototype.hasOwnProperty.call(setTimeout, 'clock')
    );
  }

  return false;
}
