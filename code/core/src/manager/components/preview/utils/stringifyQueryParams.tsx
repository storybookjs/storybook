import qs from 'qs';

export const stringifyQueryParams = (queryParams: Record<string, string>) =>
  qs.stringify(queryParams, { addQueryPrefix: true, encode: false }).replace(/^\?/, '&');
