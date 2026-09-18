import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { devtoolsSpikePlugin } from '../../src/node/vite-plugin.ts';

export default defineConfig({
  plugins: [react(), devtoolsSpikePlugin({ storiesGlob: 'src/components/**' })],
});
