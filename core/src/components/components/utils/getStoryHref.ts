function parseQuery(queryString: string) {
  const query: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}

export const getStoryHref = (
  baseUrl: string,
  storyId: string,
  additionalParams: Record<string, string> = {}
) => {
  const [url, paramsStr] = baseUrl.split('?');
  const params = paramsStr
    ? {
        ...parseQuery(paramsStr),
        ...additionalParams,
        id: storyId,
      }
    : {
        ...additionalParams,
        id: storyId,
      };
  return `${url}?${Object.entries(params)
    .map((item) => `${item[0]}=${item[1]}`)
    .join('&')}`;
};
