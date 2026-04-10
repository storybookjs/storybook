import React from 'react';
import { fn } from 'storybook/test';
import type { createServerFn as _createServerFn } from '@tanstack/start-client-core';
import { onNavigate } from './spies';

export function useServerFn<T extends (...args: Array<any>) => Promise<any>>(
  serverFn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return React.useCallback(
    (...args: Parameters<T>) => serverFn(...args) as ReturnType<T>,
    [serverFn]
  );
}

function createMockServerFnBuilder(): any {
  const builder = () => createMockServerFnBuilder();

  builder.options = {};

  builder.middleware = () => {
    return createMockServerFnBuilder();
  };

  builder.inputValidator = () => {
    return createMockServerFnBuilder();
  };

  builder.handler = (handlerFn?: (...args: any[]) => any) => {
    const mock = fn().mockName('@tanstack/start-client-core::createServerFn.handler()');

    if (handlerFn) {
      mock.mockImplementation(async (opts?: any) => handlerFn(opts));
    }

    return mock;
  };

  return builder;
}

// Override `createServerFn` from start-client-core with our mock version
export const createServerFn: typeof _createServerFn = () => {
  return createMockServerFnBuilder();
};

export const Link = ({
  to,
  children,
  ...props
}: {
  to: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => React.createElement('a', { href: to, ...props }, children);

export const Navigate = ({ to }: { to: string }) => {
  React.useEffect(() => {
    onNavigate({ to });
  }, [to]);

  return null;
};

export const notFound = () => {
  throw new Error('Not found');
};
