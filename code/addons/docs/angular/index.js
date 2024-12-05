/* eslint-disable no-underscore-dangle */

export const setCompodocJson = (compodocJson) => {
  // @ts-expect-error (Converted from ts-ignore)
  globalThis.__STORYBOOK_COMPODOC_JSON__ = compodocJson;
};
