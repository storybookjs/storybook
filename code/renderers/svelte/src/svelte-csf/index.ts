import type {
  Meta as MetaType,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  CmpOrArgs,
} from '#types';

import StoryComponent from './runtime/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from './runtime/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from './runtime/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from './runtime/LegacyTemplate.svelte';
// FIXME: Testing, remove before release
import Button from '../examples/components/Button.svelte';
// FIXME: Testing, remove before release
import { mount } from 'svelte';

export { setTemplate } from './runtime/contexts/template.svelte';


export function defineMeta<
  const TCmpOrArgs extends CmpOrArgs,
>(meta: MetaType<TCmpOrArgs>) {
  return {
    Story: StoryComponent as typeof StoryComponent<TCmpOrArgs>,
    meta,
  }
}

// FIXME: Testing, remove before release
const { Story } = defineMeta({
  component: Button,
  args: {
    size: "small"
  },
});

// FIXME: Testing, remove before release
mount(Story, {
  props: {
    name: "Primary",
    args: {
      primary: true
    },
    play: (context) => {
      context.args.size;
    },
  },
  target: window.document,
});

export type Args<TStoryCmp> =
  TStoryCmp extends typeof StoryComponent<infer TCmpOrArgs extends CmpOrArgs>
  ? NonNullable<StoryAnnotations<TCmpOrArgs>['args']>
  : never;

export type StoryContext<TStoryCmp> =
  TStoryCmp extends typeof StoryComponent<infer TCmpOrArgs extends CmpOrArgs>
  ? BaseStoryContext<TCmpOrArgs>
  : never;

// TODO: Remove in next major release
export {
  /**
   * @deprecated Use `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
   */
  LegacyMetaComponent as Meta,
  /**
   * @deprecated Use `Story` component returned from `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
   */
  LegacyStoryComponent as Story,
  /**
   * @deprecated Use snippets instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
   */
  LegacyTemplateComponent as Template,
};
