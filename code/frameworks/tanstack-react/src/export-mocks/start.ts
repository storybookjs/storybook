import React from 'react';
import { fn } from 'storybook/test';
import type { createServerFn as _createServerFn } from '@tanstack/start-client-core';
import { onNavigate } from './spies.ts';
export * from '@tanstack/start-client-core';
export * from '@tanstack/react-start';

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

  let _storedOptions: any;

  builder.options = (opts?: any) => {
    _storedOptions = opts;
    return builder;
  };

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

  (builder as any)._getOptions = () => _storedOptions;

  return builder;
}

// Override `createServerFn` from start-client-core with our mock version
export const createServerFn: typeof _createServerFn = (options?: any) => {
  const builder = createMockServerFnBuilder();
  if (options !== undefined) {
    builder.options(options);
  }
  return builder;
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

// TanStack Start server entry
export const createStart = () => ({});

// Cookie helpers
const cookieStore = new Map<string, string>();

export const setCookie = (name: string, value: string) => {
  cookieStore.set(name, value);
};

export const getCookie = (name: string) => cookieStore.get(name);

export const deleteCookie = (name: string) => {
  cookieStore.delete(name);
};

export const clearCookieStore = () => {
  cookieStore.clear();
};

// Server entry default export
const fetchHandler = async () => new Response('Storybook Mock', { status: 200 });

export { fetchHandler as fetch };

export default { fetch: fetchHandler };
