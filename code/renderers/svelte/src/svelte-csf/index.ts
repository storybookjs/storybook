/**
 * @package
 *
 * For a better TypeScript experience, it is recommended to use {@link typed} helper.
 *
 * Example:
 * ```svelte
 * <script context="module" lang="ts">
 *   import { Meta } from "@storybook/svelte";
 *
 *   import Button from "./Button.svelte";
 *
 *   export const meta: Meta<Button> = {
 *     args: { rounded: true },
 *   };
 * </script>
 *
 * <script lang="ts">
 *   import { typed } from "@storybook/addon-svelte-csf";
 *
 *   const { Template, Story } = typed(meta);
 * </script>
 * ```
 */

import type { Args, Meta } from '@storybook/svelte';
import type { SvelteComponent } from 'svelte';

import Story from './components/Story.svelte';
import Template from './components/Template.svelte';

if (module?.hot?.decline) {
  module.hot.decline();
}

interface AddonComponents<Component extends SvelteComponent = SvelteComponent> {
  Template: typeof Template<Component>;
  Story: typeof Story<Component>;
}

// TODO: Suggest to use name `create` instead
export function typed<const M extends Meta>(meta?: M): Infer<M> {
  return {
    Template,
    Story,
  } as Infer<M>;
}

type Infer<M extends Meta> =
  M extends Meta<infer ArgsOrCmp>
    ? ArgsOrCmp extends SvelteComponent
      ? AddonComponents<ArgsOrCmp>
      : ArgsOrCmp extends Args
        ? AddonComponents<SvelteComponent<ArgsOrCmp>>
        : never
    : never;

export { Template, Story };
