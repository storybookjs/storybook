import { fn } from '@storybook/test';

import { HeadersAdapter } from 'next/dist/server/web/spec-extension/adapters/headers';

class HeadersAdapterMock extends HeadersAdapter {
  constructor() {
    super({});
  }

  append = fn(super.append.bind(this)).mockName('next/headers::headers().append');

  delete = fn(super.delete.bind(this)).mockName('next/headers::headers().delete');

  get = fn(super.get.bind(this)).mockName('next/headers::headers().get');

  has = fn(super.has.bind(this)).mockName('next/headers::headers().has');

  set = fn(super.set.bind(this)).mockName('next/headers::headers().set');

  forEach = fn(super.forEach.bind(this)).mockName('next/headers::headers().forEach');

  entries = fn(super.entries.bind(this)).mockName('next/headers::headers().entries');

  keys = fn(super.keys.bind(this)).mockName('next/headers::headers().keys');

  values = fn(super.values.bind(this)).mockName('next/headers::headers().values');
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
