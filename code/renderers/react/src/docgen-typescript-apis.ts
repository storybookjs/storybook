import type { TypeScriptDocgenApi } from 'storybook/internal/common';

// React's docgen server runs on the compiler API of TypeScript 5.9 and 6, and on the native API of
// TypeScript 7.1 and newer.
export const REACT_DOCGEN_TYPESCRIPT_APIS: readonly TypeScriptDocgenApi[] = ['compiler', 'native'];
