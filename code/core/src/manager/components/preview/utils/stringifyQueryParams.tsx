import { stringify } from 'picoquery';

export const stringifyQueryParams = (queryParams: Record<string, string>) => {
  const result = stringify(queryParams);
  if (result === '') {
    return '';
  }

  return `&${result}`;
};
