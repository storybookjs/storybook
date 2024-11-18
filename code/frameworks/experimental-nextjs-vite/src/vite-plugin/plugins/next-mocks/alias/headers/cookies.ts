import type { Mock } from 'vitest';

import { fn } from '@storybook/test';

import {
  type RequestCookie,
  RequestCookies,
} from 'next/dist/compiled/@edge-runtime/cookies/index.js';

import { headers } from './index.js';

class RequestCookiesMock extends RequestCookies {
  get: Mock<(...args: [name: string] | [RequestCookie]) => RequestCookie | undefined> = fn(
    super.get.bind(this)
  ).mockName('next/headers::cookies().get');

  getAll: Mock<(...args: [name: string] | [RequestCookie] | []) => RequestCookie[]> = fn(
    super.getAll.bind(this)
  ).mockName('next/headers::cookies().getAll');

  has: Mock<(name: string) => boolean> = fn(super.has.bind(this)).mockName(
    'next/headers::cookies().has'
  );

  set: Mock<(...args: [key: string, value: string] | [options: RequestCookie]) => this> = fn(
    super.set.bind(this)
  ).mockName('next/headers::cookies().set');

  delete: Mock<(names: string | string[]) => boolean | boolean[]> = fn(
    super.delete.bind(this)
  ).mockName('next/headers::cookies().delete');
}

let requestCookiesMock: RequestCookiesMock;

export const cookies: Mock<() => RequestCookiesMock> = fn(() => {
  if (!requestCookiesMock) {
    requestCookiesMock = new RequestCookiesMock(headers());
  }
  return requestCookiesMock;
}).mockName('next/headers::cookies()');

const originalRestore = cookies.mockRestore.bind(null);

// will be called automatically by the test loader
cookies.mockRestore = () => {
  originalRestore();
  headers.mockRestore();
  requestCookiesMock = new RequestCookiesMock(headers());
};
