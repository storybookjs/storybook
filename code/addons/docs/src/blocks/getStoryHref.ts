// Only for internal use in addon-docs code, because the parent util in `core` cannot be imported.
// Unlike the parent util, this one only returns the preview URL.
export const getStoryHref = (storyId: string, additionalParams: Record<string, string> = {}) => {
  const baseUrl = globalThis.PREVIEW_URL || 'iframe.html';
  const [url, paramsStr] = baseUrl.split('?');
  const params = new URLSearchParams(paramsStr || '');

  Object.entries(additionalParams).forEach(([key, value]) => {
    params.set(key, value);
  });

  params.set('id', storyId);

  return `${url}?${params.toString()}`;
};
