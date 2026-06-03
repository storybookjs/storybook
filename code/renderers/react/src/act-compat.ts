// Adapted from
// https://github.com/testing-library/react-testing-library/blob/3dcd8a9649e25054c0e650d95fca2317b7008576/src/act-compat.js
import * as React from 'react';

declare const globalThis: {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

// We need to spread React to avoid
// export 'act' (imported as 'React4') was not found in 'react' errors in webpack
// We do check if act exists, but webpack will still throw an error on compile time
const clonedReact = { ...React };

export function setReactActEnvironment(isReactActEnvironment: boolean) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = isReactActEnvironment;
}

export function getReactActEnvironment() {
  return globalThis.IS_REACT_ACT_ENVIRONMENT;
}

// Storybook interleaves act calls across stories, so a per-call save/restore
// (as react-testing-library does) is wrong: the first call to settle would
// clear the flag while others are still in flight. Ref-count instead, and only
// restore the captured baseline once the last concurrent act settles.
// See https://github.com/storybookjs/storybook/issues/34708.
const actEnvironment = {
  depth: 0,
  baseline: false,
  enter() {
    if (this.depth === 0) {
      this.baseline = getReactActEnvironment();
    }
    this.depth = this.depth + 1;
    setReactActEnvironment(true);
  },
  exit() {
    this.depth = this.depth - 1;
    if (this.depth === 0) {
      setReactActEnvironment(this.baseline);
    }
  },
};

function withGlobalActEnvironment(actImplementation: (callback: () => void) => Promise<any>) {
  return (callback: () => any) => {
    actEnvironment.enter();
    try {
      // The return value of `act` is always a thenable.
      let callbackNeedsToBeAwaited = false;
      const actResult = actImplementation(() => {
        const result = callback();
        if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
          callbackNeedsToBeAwaited = true;
        }
        return result;
      });
      if (callbackNeedsToBeAwaited) {
        const thenable = actResult;
        // Attach to React's act thenable eagerly (the executor runs
        // synchronously): some pipeline callers (e.g. the testing-library
        // `eventWrapper`) discard the result without awaiting, yet the
        // environment reset must still be tied to the act work settling. We wrap
        // it in a real Promise because React's act thenable is non-conformant —
        // its `.then` returns `undefined` rather than a chainable promise.
        return new Promise((resolve, reject) => {
          thenable.then(
            (returnValue: any) => {
              actEnvironment.exit();
              resolve(returnValue);
            },
            (error: any) => {
              actEnvironment.exit();
              reject(error);
            }
          );
        });
      } else {
        actEnvironment.exit();
        return actResult;
      }
    } catch (error) {
      // Not a `finally`: the async branch defers exit() until the act thenable
      // settles, so finally would call exit() twice. This only covers sync throws.
      actEnvironment.exit();
      throw error;
    }
  };
}

export const getAct = async ({ disableAct = false }: { disableAct?: boolean } = {}) => {
  if (process.env.NODE_ENV === 'production' || disableAct) {
    return (cb: (...args: any[]) => any) => cb();
  }

  let reactAct: typeof React.act;
  if (typeof clonedReact.act === 'function') {
    reactAct = clonedReact.act;
  } else {
    // Lazy loading this makes sure that @storybook/react can be loaded in SSR contexts
    // For example when SSR'ing portable stories
    const deprecatedTestUtils = await import('react-dom/test-utils');
    reactAct = deprecatedTestUtils?.default?.act ?? deprecatedTestUtils.act;
  }

  return withGlobalActEnvironment(reactAct);
};
