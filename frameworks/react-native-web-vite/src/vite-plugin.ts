import { rnw } from 'vite-plugin-rnw';
import tsconfigPaths from 'vite-tsconfig-paths';

export const storybookReactNativeWeb = () => {
  return [
    tsconfigPaths(),
    rnw({
      jsxRuntime: 'automatic',
    }),
  ];
};
