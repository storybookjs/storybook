import type { ReactElement } from 'react';
import * as React from 'react';
import type { Root as ReactRoot, RootOptions } from 'react-dom/client';
import * as ReactDOM from 'react-dom/client';

type RootState = {
  root: ReactRoot;
  pendingRenders: Set<() => void>;
};

const nodes = new Map<Element, RootState>();

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

const settlePendingRenders = ({ pendingRenders }: RootState) => {
  pendingRenders.forEach((resolve) => resolve());
  pendingRenders.clear();
};

export const renderElement = async (node: ReactElement, el: Element, rootOptions?: RootOptions) => {
  let state = nodes.get(el);

  if (!state) {
    state = {
      root: ReactDOM.createRoot(el, rootOptions),
      pendingRenders: new Set(),
    };
    nodes.set(el, state);
  }

  settlePendingRenders(state);

  if (globalThis.IS_REACT_ACT_ENVIRONMENT) {
    state.root.render(node);
    return;
  }

  const { promise, resolve } = createPromise<void>();
  const onCommit = () => {
    state.pendingRenders.delete(onCommit);
    resolve();
  };
  state.pendingRenders.add(onCommit);
  state.root.render(<WithCallback callback={onCommit}>{node}</WithCallback>);
  return promise;
};

export const unmountElement = (el: Element) => {
  const state = nodes.get(el);

  if (state) {
    state.root.unmount();
    settlePendingRenders(state);
    nodes.delete(el);
  }
};
