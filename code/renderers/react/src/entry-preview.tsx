import * as React from 'react';

import { Tag } from 'storybook/internal/preview-api';

import { global } from '@storybook/global';

import { configure } from 'storybook/test';
import type { getConfig } from 'storybook/test';

import { getAct, getReactActEnvironment, setReactActEnvironment } from './act-compat.ts';
import type { Decorator } from './public-types.ts';

export { render } from './render.tsx';
export { renderToCanvas } from './renderToCanvas.tsx';
export { mount } from './mount.ts';
export { applyDecorators } from './applyDecorators.ts';

export const decorators: Decorator[] = [
  (story, context) => {
    if (!context.parameters?.react?.rsc) {
      return story();
    }

    const [major, minor] = React.version.split('.').map((part) => parseInt(part, 10));

    if (!Number.isInteger(major) || !Number.isInteger(minor)) {
      throw new Error('Unable to parse React version');
    }
    if (major < 18 || (major === 18 && minor < 3)) {
      throw new Error('React Server Components require React >= 18.3');
    }

    return <React.Suspense>{story()}</React.Suspense>;
  },
  (story, context) => {
    // @ts-expect-error this feature flag only exists in the react frameworks
    if (context.tags?.includes(Tag.TEST_FN) && !global.FEATURES?.experimentalTestSyntax) {
      throw new Error(
        'To use the experimental test function, you must enable the experimentalTestSyntax feature flag. See https://storybook.js.org/docs/api/main-config/main-config-features#experimentaltestsyntax'
      );
    }
    return story();
  },
];

export const parameters = {
  renderer: 'react',
};

let actPromise: ReturnType<typeof getAct> | undefined;

// The act wrappers belong to the stories React renders: they stay set while one of them is set up
// (a docs page sets up several and leaves them in page order, not in reverse), and a story of
// another renderer gets back the wrappers it would have had without React.
let activeStoryCount = 0;
let wrappersWithoutReact: Partial<ReturnType<typeof getConfig>> = {};

export const beforeEach = async () => {
  try {
    actPromise ??= getAct();
    const act = await actPromise;

    if (activeStoryCount === 0) {
      // The function form passes Testing Library's own config. The instrumented `getConfig` of
      // storybook/test would track the functions of that config object for every later call.
      configure(({ unstable_advanceTimersWrapper, asyncWrapper, eventWrapper }) => {
        // `configure` merges, so the cleanup puts back only the keys React sets.
        wrappersWithoutReact = { unstable_advanceTimersWrapper, asyncWrapper, eventWrapper };
        return {};
      });
    }

    // copied from
    // https://github.com/testing-library/react-testing-library/blob/3dcd8a9649e25054c0e650d95fca2317b7008576/src/pure.js
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

            const jestFakeTimers = getActiveJestFakeTimers(globalThis);
            if (jestFakeTimers) {
              jestFakeTimers.advanceTimersByTime(0);
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
    activeStoryCount += 1;

    return () => {
      activeStoryCount -= 1;
      if (activeStoryCount === 0) {
        configure(wrappersWithoutReact);
      }
    };
  } catch (e) {
    // no-op
    // storybook/test might not be available
  }
};

/** Returns jest's fake-timer API when it's active, so callers can advance fake timers safely. */
function getActiveJestFakeTimers(
  g: typeof globalThis
): { advanceTimersByTime: (ms: number) => void } | undefined {
  const jest = Reflect.get(g, 'jest');
  if (jest === undefined || jest === null) {
    return undefined;
  }

  const fakeTimersEnabled =
    // legacy timers

    (setTimeout as any)._isMockFunction === true || // modern timers
    Object.prototype.hasOwnProperty.call(setTimeout, 'clock');

  return fakeTimersEnabled ? jest : undefined;
}
