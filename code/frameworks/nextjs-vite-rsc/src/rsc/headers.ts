import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { HeadersAdapter } from 'next/dist/server/web/spec-extension/adapters/headers';
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

const headersAdapter = new HeadersAdapter({});
export const headers = () => headersAdapter;
export const cookies = () => RequestCookiesAdapter.seal(new RequestCookies(headersAdapter));
