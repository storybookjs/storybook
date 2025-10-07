import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { HeadersAdapter } from 'next/dist/server/web/spec-extension/adapters/headers';
import { fn } from 'storybook/test';

let headersAdapter = new HeadersAdapter({});
let requestCookies = new RequestCookies(headersAdapter);

export const cookies = fn(() => requestCookies);
export const headers = fn(() => headersAdapter);

const originalRestore = cookies.mockRestore.bind(null);

cookies.mockRestore = () => {
  originalRestore();
  headersAdapter = new HeadersAdapter({});
  requestCookies = new RequestCookies(headersAdapter);
};
