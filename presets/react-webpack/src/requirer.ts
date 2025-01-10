// Use it in favour of require.resolve() to be able to mock it in tests.
export function requirer(resolver: (path: string) => string, path: string) {
  return resolver(path);
}
