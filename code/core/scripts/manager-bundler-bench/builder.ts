import { globSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Components that Storybook 11 removed from `storybook/internal/components`. An addon importing
 * one of them fails the manager build with either bundler. Declaring the names again lets such
 * addons be bundled (they resolve to `undefined` at runtime); as the module is a global external,
 * this does not change the amount of code that is bundled.
 */
const REMOVED_COMPONENT_EXPORTS = [
  'IconButton',
  'WithTooltip',
  'TooltipMessage',
  'TooltipLinkList',
];

/**
 * Loads the compiled manager builder, which is what a published Storybook runs. It is not a public
 * entry point, so it is located by its chunk name.
 */
export const loadManagerBuilder = async ({
  coreDir = resolve(import.meta.dirname, '../..'),
  shimRemovedExports = false,
} = {}) => {
  const [chunk] = globSync('dist/_node-chunks/builder-manager-*.js', { cwd: coreDir });
  const builder = await import(pathToFileURL(join(coreDir, chunk)).href);

  if (shimRemovedExports) {
    builder.globalsModuleInfoMap['storybook/internal/components'].namedExports.push(
      ...REMOVED_COMPONENT_EXPORTS
    );
  }
  return builder;
};
