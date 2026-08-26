import type { BuildOptions } from 'esbuild';

// https://esbuild.github.io/api/#target
export const BROWSER_TARGETS: BuildOptions['target'] = [
  'chrome147',
  'edge150',
  'firefox152',
  'safari26.5',
  'ios26.5',
];

// https://esbuild.github.io/api/#target
export const NODE_TARGET: BuildOptions['target'] = 'node20.19';

// https://esbuild.github.io/api/#supported
export const SUPPORTED_FEATURES: BuildOptions['supported'] = {
  // React Native does not support class static blocks without a specific babel plugin
  'class-static-blocks': false,
};
