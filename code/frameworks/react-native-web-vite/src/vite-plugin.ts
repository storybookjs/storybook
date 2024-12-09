import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

import { reactNativeWeb } from './preset';

export const storybookReactNativeWeb = () => {
  return [
    tsconfigPaths(),
    react({
      babel: {
        babelrc: false,
        configFile: false,
      },
      jsxRuntime: 'automatic',
    }),
    reactNativeWeb(),
  ];
};
