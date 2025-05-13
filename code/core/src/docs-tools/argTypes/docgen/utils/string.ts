export const str = (obj: any) => {
  if (!obj) {
    return '';
  }
  if (typeof obj === 'string') {
    return obj as string;
  }
  throw new Error(`Description: expected string, got: ${JSON.stringify(obj)}`);
};
