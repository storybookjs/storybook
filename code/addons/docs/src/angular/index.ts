export const setCompodocJson = (compodocJson: any) => {
  // @ts-expect-error (Converted from ts-ignore)
  globalThis.__STORYBOOK_COMPODOC_JSON__ = compodocJson;
};
