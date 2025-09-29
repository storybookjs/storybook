import { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';
import { HeadersAdapter } from 'next/dist/server/web/spec-extension/adapters/headers';
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

const headersAdapter = new HeadersAdapter({});
export const headers = async () => headersAdapter;
export const cookies = async () => RequestCookiesAdapter.seal(new RequestCookies(headersAdapter));
