import type { Plugin } from 'vite';

/**
 * Devtools spike Vite plugin — stub. The Stage 0 task fills in the real
 * behavior: transformIndexHtml client-script injection and the
 * /__sb-devtools/capture middleware, both gated to serve mode only
 * (vite-inject-mocker pattern, builder-vite/src/plugins/vite-inject-mocker).
 */
export function devtoolsSpikePlugin(): Plugin {
  return {
    name: 'storybook:devtools-spike',
  };
}
