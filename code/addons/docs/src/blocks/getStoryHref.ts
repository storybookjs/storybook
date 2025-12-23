const baseUrl = globalThis.PREVIEW_URL || 'iframe.html';
const [url, paramsStr] = baseUrl.split('?');

export const getStoryHref = (storyId: string, additionalParams: Record<string, string> = {}) => {
  const params = {
    ...(paramsStr ? parseQuery(paramsStr) : {}),
    ...additionalParams,
    id: storyId,
  };
  return `${url}?${Object.entries(params)
    .map((item) => `${item[0]}=${item[1]}`)
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
