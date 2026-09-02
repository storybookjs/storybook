import { createRequire } from 'node:module';

type ReactDocgen = typeof import('react-docgen');

let reactDocgen: ReactDocgen | undefined;

/**
 * `react-docgen` ships its own copy of babel (over 300 modules), which every `storybook` command
 * would otherwise evaluate through the preset even when the project extracts with
 * `react-component-meta` or never extracts at all. Resolve it when a caller actually parses.
 */
export function requireReactDocgen(): ReactDocgen {
  return (reactDocgen ??= createRequire(import.meta.url)('react-docgen'));
}
