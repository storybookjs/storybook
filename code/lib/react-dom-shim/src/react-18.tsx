/* eslint-disable @typescript-eslint/no-unnecessary-type-constraint */
import type { FC, ReactElement } from 'react';
import * as React from 'react';
import type { Root as ReactRoot, RootOptions } from 'react-dom/client';
import * as ReactDOM from 'react-dom/client';

import { preventActChecks } from './preventActChecks';

// A map of all rendered React 18 nodes
const nodes = new Map<Element, ReactRoot>();

const WithCallback: FC<{ callback: () => void; children: ReactElement }> = ({
  callback,
  children,
}) => {
  // See https://github.com/reactwg/react-18/discussions/5#discussioncomment-2276079
  const once = React.useRef<() => void>();
  React.useLayoutEffect(() => {
    if (once.current === callback) return;
    once.current = callback;
    callback();
  }, [callback]);

  return children;
};

// pony-fill
if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = <T extends unknown>() => {
    let resolve: PromiseWithResolvers<T>['resolve'] = null!;
    let reject: PromiseWithResolvers<T>['reject'] = null!;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export const renderElement = async (node: ReactElement, el: Element, rootOptions?: RootOptions) => {
  // Create Root Element conditionally for new React 18 Root Api
  const root = await getReactRoot(el, rootOptions);

  const { promise, resolve } = Promise.withResolvers<void>();
  preventActChecks(() => root.render(<WithCallback callback={resolve}>{node}</WithCallback>));
  return promise;
};

export const unmountElement = (el: Element, shouldUseNewRootApi?: boolean) => {
  const root = nodes.get(el);

  if (root) {
    preventActChecks(() => root.unmount());
    nodes.delete(el);
  }
};

const getReactRoot = async (el: Element, rootOptions?: RootOptions): Promise<ReactRoot> => {
  let root = nodes.get(el);

  if (!root) {
    root = ReactDOM.createRoot(el, rootOptions);
    nodes.set(el, root);
  }

  return root;
};
