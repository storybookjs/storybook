const NODE_MODULES_RE = /node_modules/;

// Exclude node_modules stories everywhere we call `glob`
export const commonGlobOptions = (glob: string) =>
  NODE_MODULES_RE.test(glob) ? {} : { ignore: ['**/node_modules/**'] };
