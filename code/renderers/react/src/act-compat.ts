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
        return {
          then: (resolve: (param: any) => void, reject: (param: any) => void) => {
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
          },
        };
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
