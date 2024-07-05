import pkg from '@storybook/addon-svelte-csf/package.json' with { type: 'json' };
import type { ImportDeclaration } from 'estree';

/**
 * The export is defined in the `package.json` export map
 */
export function createRuntimeStoriesImport(): ImportDeclaration {
  const imported = {
    type: 'Identifier',
    // WARN: Tempting to use `createRuntimeStories.name` here.
    // It will break, because this function imports `*.svelte` files.
    name: 'createRuntimeStories',
  } as const;

  return {
    type: 'ImportDeclaration',
    source: {
      type: 'Literal',
      // TODO: Probably possible to achieve picking the whole path from `pkg.exports` with Object.keys or something like that
      value: `${pkg.name}/internal/create-runtime-stories`,
    },
    specifiers: [
      {
        type: 'ImportSpecifier',
        imported,
        local: imported,
      },
    ],
  };
}
