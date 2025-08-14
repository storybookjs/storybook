import { createContext } from 'react';

export const AppContext = createContext({
  packageManager: undefined as import('storybook/internal/common').JsPackageManager | undefined,
});
