import type { Mock } from 'vitest';

import { fn } from '@storybook/test';

import { HeadersAdapter } from 'next/dist/server/web/spec-extension/adapters/headers.js';

class HeadersAdapterMock extends HeadersAdapter {
  constructor() {
    super({});
  }

  append: Mock<(name: string, value: string) => void> = fn(super.append.bind(this)).mockName(
    'next/headers::headers().append'
  );

  delete: Mock<(name: string) => void> = fn(super.delete.bind(this)).mockName(
    'next/headers::headers().delete'
  );

  get: Mock<(name: string) => string | null> = fn(super.get.bind(this)).mockName(
    'next/headers::headers().get'
  );

  has: Mock<(name: string) => boolean> = fn(super.has.bind(this)).mockName(
    'next/headers::headers().has'
  );

  set: Mock<(name: string, value: string) => void> = fn(super.set.bind(this)).mockName(
    'next/headers::headers().set'
  );

  forEach: Mock<
    (callbackfn: (value: string, name: string, parent: Headers) => void, thisArg?: any) => void
  > = fn(super.forEach.bind(this)).mockName('next/headers::headers().forEach');

  entries: Mock<() => IterableIterator<[string, string]>> = fn(super.entries.bind(this)).mockName(
    'next/headers::headers().entries'
  );

  keys: Mock<() => IterableIterator<string>> = fn(super.keys.bind(this)).mockName(
    'next/headers::headers().keys'
  );

  values: Mock<() => IterableIterator<string>> = fn(super.values.bind(this)).mockName(
    'next/headers::headers().values'
  );
}

let headersAdapterMock: HeadersAdapterMock;

export const headers = () => {
  if (!headersAdapterMock) {
    headersAdapterMock = new HeadersAdapterMock();
  }
  return headersAdapterMock;
};

// This fn is called by ./cookies to restore the headers in the right order
headers.mockRestore = () => {
  headersAdapterMock = new HeadersAdapterMock();
};
