export const str = (obj: any): string => {
  if (!obj) {
    return '';
  }
  if (typeof obj === 'string') {
    return obj as string;
  }
  throw new Error(`Description: expected string, got: ${JSON.stringify(obj)}`);
};
