import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const demoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../demo/react-19');

const config: StorybookConfig = {
  stories: ['../demo/react-19/src/components/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  viteFinal: async (config) => {
    // The demo has its own pinned React 19.2 install (regime 2). Without this
    // alias the dep optimizer bundles the renderer's React from the workspace
    // while the demo components' jsx-dev-runtime resolves the demo's copy —
    // two instances on one page, so every element from one is an invalid
    // object to the other's reconciler ("Objects are not valid as a React
    // child … keys {$$typeof, type, key, props, _owner, _store}"). Alias every
    // react resolution to the demo's copy so the page has exactly one React.
    const reactDir = path.join(demoRoot, 'node_modules/react');
    const reactDomDir = path.join(demoRoot, 'node_modules/react-dom');
    config.resolve ??= {};
    config.resolve.alias = [
      ...(Array.isArray(config.resolve.alias) ? config.resolve.alias : []),
      { find: /^react$/, replacement: reactDir },
      { find: /^react\/(.*)$/, replacement: `${reactDir}/$1` },
      { find: /^react-dom(.*)$/, replacement: `${reactDomDir}$1` },
    ];
    return config;
  },
};

export default config;
