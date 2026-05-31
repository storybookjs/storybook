// Copied from
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

function withGlobalActEnvironment(actImplementation: (callback: () => void) => Promise<any>) {
  return (callback: () => any) => {
    const previousActEnvironment = getReactActEnvironment();
    setReactActEnvironment(true);
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
        // synchronously) rather than returning a lazy thenable that only forwards
        // `.then` once a caller awaits it. Some callers in the render pipeline
        // (e.g. the testing-library `eventWrapper`, or async teardown paths)
        // discard the result without awaiting it; with the lazy approach that
        // left `IS_REACT_ACT_ENVIRONMENT` stuck `true`, leaking across story
        // boundaries and causing React to log spurious
        // "act(async () => ...) without await" warnings in multi-file Vitest
        // browser-mode runs. Eagerly invoking React's `.then` ties the
        // environment reset to the act work settling rather than to whether the
        // caller awaits, and satisfies React's own await tracking. We wrap it in
        // a real Promise because React's act thenable is non-conformant: its
        // `.then` returns `undefined` rather than a chainable promise.
        // See https://github.com/storybookjs/storybook/issues/34708.
        return new Promise((resolve, reject) => {
          thenable.then(
            (returnValue: any) => {
              setReactActEnvironment(previousActEnvironment);
              resolve(returnValue);
            },
            (error: any) => {
              setReactActEnvironment(previousActEnvironment);
              reject(error);
            }
          );
        });
      } else {
        setReactActEnvironment(previousActEnvironment);
        return actResult;
      }
    } catch (error) {
      // Can't be a `finally {}` block since we don't know if we have to immediately restore IS_REACT_ACT_ENVIRONMENT
      // or if we have to await the callback first.
      setReactActEnvironment(previousActEnvironment);
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
