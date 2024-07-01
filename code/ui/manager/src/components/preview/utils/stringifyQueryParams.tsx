import { stringify } from 'picoquery';

export const stringifyQueryParams = (queryParams: Record<string, string>) =>
  '&' + stringify(queryParams);
