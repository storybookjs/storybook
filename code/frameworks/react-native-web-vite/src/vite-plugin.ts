import react from '@vitejs/plugin-react';

import { reactNativeWeb } from './preset';

export const storybookReactNativeWeb = () => {
  return [
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
