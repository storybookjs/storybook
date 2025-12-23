export const getStoryHref = (storyId: string, additionalParams: Record<string, string> = {}) => {
  const baseUrl = globalThis.PREVIEW_URL || 'iframe.html';
  const [url, paramsStr] = baseUrl.split('?');
  const params = {
    ...(paramsStr ? parseQuery(paramsStr) : {}),
    ...additionalParams,
    id: storyId,
  };
  return `${url}?${Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')}`;
};

function parseQuery(queryString: string) {
  const query: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split('=');
    query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
  }
  return query;
}
