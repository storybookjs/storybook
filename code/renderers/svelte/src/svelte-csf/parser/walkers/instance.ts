import { walk } from 'estree-walker';
import type { Root, SvelteNode } from 'svelte/compiler';

import pkg from '../../../package.json' with { type: 'json' };

// FIXME: Might be obsolete, we don't parse anything from instance anymore, since we moved to export meta.
export function walkOnInstance(instance: Root['instance']) {
  /** ID of the default component */
  const allocatedIds = new Set<string>(['default']);
  const addonComponents = {
    Story: 'Story',
    Template: 'Template',
  };

  if (instance) {
    // NOTE: Is it to extract the component names, in case they've got overriden, e.g. `Story as`
    walk(instance.content, {
      enter(node: SvelteNode) {
        if (node.type === 'ImportDeclaration') {
          const { specifiers } = node;

          // FIXME:
          // Might be obsolete.
          // Given that we don't use import { Story, Template } from `@storybook/addoon-svelte-csf` anymore.
          // Instead, we use the destructed from the `typed/create(meta)`
          if (node.source.value === pkg.name) {
            for (const specifier of specifiers) {
              if (specifier.type === 'ImportSpecifier') {
                addonComponents[specifier.imported.name] = specifier.local.name;
              }
            }
          } else {
            // FIXME:
            // Does this means we can't use `import Button from '../Button.svelte'` inside the module tag _(`<script context="module">`)_?
            for (const specifier of specifiers) {
              if (specifier.type === 'ImportSpecifier') {
                allocatedIds.add(specifier.local.name);
              }
            }
          }

          this.skip();
        }

        this.skip();
      },
    });
  }

  return { allocatedIds, addonComponents };
}
