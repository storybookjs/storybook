import { walk } from 'estree-walker';
import type { Root, SvelteNode } from 'svelte/compiler';
import '@total-typescript/ts-reset/array-includes';

import pkg from '../../../package.json' with { type: 'json' };

import { ADDON_COMPONENT_NAMES, type AddonComponentName, type InstanceMeta } from '../types.js';
import type { Program } from 'estree';

export function walkOnInstance(instance: Root['instance']): InstanceMeta {
  let addonComponents = {
    Story: 'Story',
    Template: 'Template',
  };

  if (instance) {
    walk(instance.content, {
      enter(node: SvelteNode) {
        if (node.type === 'Program') {
          const { components } = walkOnProgramBody(node.body, addonComponents);

          addonComponents = components;
        }

        this.skip();
      },
    });
  }

  return { addonComponents };
}

function walkOnProgramBody(body: Program['body'], components: Record<AddonComponentName, string>) {
  for (const node of body) {
    if (node.type === 'ImportDeclaration') {
      const { specifiers, source } = node;

      if (
        source.value === pkg.name ||
        // FIXME:
        // This should be for this package testing purpose only.
        // Need a condition to prevent it running outside this package
        (typeof source.value === 'string' && source.value.includes('src/index'))
      ) {
        for (const specifier of specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            ADDON_COMPONENT_NAMES.includes(specifier.imported.name)
          ) {
            components[specifier.imported.name] = specifier.local.name;
          }
        }
      }
    }
  }

  return { components };
}
