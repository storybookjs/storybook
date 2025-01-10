export function ComponentWithError() {
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  throw new Error('Error in render');
}
