import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Embed host for the devtools spike (strategy A): a minimal Storybook config
 * inside the spike package, running from workspace sources. The stories glob
 * covers the react-19 demo's components — exactly the write area the capture
 * middleware's storiesGlob allows.
 *
 * Start with:
 *   node code/core/dist/bin/dispatcher.js dev --port 6006 \
 *     --config-dir code/lib/devtools-spike/.storybook
 */
const config: StorybookConfig = {
  stories: ['../demo/react-19/src/components/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
};

export default config;
