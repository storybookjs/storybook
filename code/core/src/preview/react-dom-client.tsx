import type { ReactElement } from 'react';
import * as React from 'react';
import type { Root as ReactRoot, RootOptions } from 'react-dom/client';
import * as ReactDOM from 'react-dom/client';

const nodes = new Map<Element, ReactRoot>();

declare const globalThis: {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};

const WithCallback: React.FC<{ callback: () => void; children: ReactElement }> = ({
  callback,
  children,
}) => {
  const once = React.useRef<() => void>();
  React.useLayoutEffect(() => {
    if (once.current === callback) {
      return;
    }
    once.current = callback;
    callback();
  }, [callback]);

  return children;
};

const createPromise = <T,>() => {
  let resolve: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve: resolve! };
};

export const renderElement = async (node: ReactElement, el: Element, rootOptions?: RootOptions) => {
  let root = nodes.get(el);

  if (!root) {
    root = ReactDOM.createRoot(el, rootOptions);
    nodes.set(el, root);
  }

  if (globalThis.IS_REACT_ACT_ENVIRONMENT) {
    root.render(node);
    return;
  }

  const { promise, resolve } = createPromise<void>();
  root.render(<WithCallback callback={resolve}>{node}</WithCallback>);
  return promise;
};

export const unmountElement = (el: Element) => {
  const root = nodes.get(el);

  if (root) {
    root.unmount();
    nodes.delete(el);
  }
};
