<script module lang="ts">
  import { expectTypeOf } from 'vitest';

  import type { Args } from '../../public-types.ts';

  import preview from './preview.ts';
  import Button from '../Button.svelte';
  import Layout from '../Layout.svelte';
  import List from '../List.svelte';

  // svelte-check fails on each `@ts-expect-error` without an error. This isn't a stories file,
  // because it has more than one meta.
  const { Story } = preview.meta({ component: Button, args: { disabled: false } });
  const { Story: LayoutStory } = preview.meta({ component: Layout });
  const { Story: RenderStory } = preview.meta({ render: textTemplate });
  const { Story: ListStory } = preview.meta({ component: List<{ id: number; name: string }> });
</script>

{#snippet textTemplate(args: { text: string })}
  <p>{args.text}</p>
{/snippet}

<Story name="Required args" args={{ label: 'Label' }} />

{/* @ts-expect-error label is missing */ null}
<Story name="Missing arg" />

<Story
  name="Wrong arg type"
  args={{
    // @ts-expect-error label must be a string
    label: 1,
  }}
/>

<Story name="As child" asChild>
  <p>Static content</p>
</Story>

<Story name="Template without parameters">
  {#snippet template()}
    <p>Static content</p>
  {/snippet}
</Story>

<Story name="Template args" args={{ label: 'Label' }}>
  {#snippet template(args, context)}
    {expectTypeOf(args.label).toEqualTypeOf<string>()}
    {expectTypeOf(context.args.disabled).toEqualTypeOf<boolean>()}
    <Button {...args} />
  {/snippet}
</Story>

{/* @ts-expect-error label is missing */ null}
<Story name="Template args missing">
  {#snippet template(args)}
    <Button {...args} />
  {/snippet}
</Story>

{#snippet sharedTemplate(args: Args<typeof Story>)}
  <Button {...args} />
{/snippet}

<Story name="Shared template" template={sharedTemplate} args={{ label: 'Label' }} />

<Story
  name="Play args"
  args={{ label: 'Label' }}
  play={async ({ args }) => {
    expectTypeOf(args.label).toEqualTypeOf<string>();
  }}
/>

<LayoutStory name="Children" args={{ title: 'Title' }}>
  <p>Content</p>
</LayoutStory>

{/* @ts-expect-error children is missing */ null}
<LayoutStory name="No children" args={{ title: 'Title' }} />

<ListStory
  name="Generic args"
  args={{
    items: [{ id: 1, name: 'Ada' }],
    getLabel: (item) => {
      expectTypeOf(item).toEqualTypeOf<{ id: number; name: string }>();
      return item.name;
    },
  }}
/>

<ListStory
  name="Generic args wrong item"
  args={{
    // @ts-expect-error name must be a string
    items: [{ id: 1, name: 1 }],
    getLabel: (item) => item.name,
  }}
/>

<RenderStory name="Render args" args={{ text: 'Text' }} />

{/* @ts-expect-error text is missing */ null}
<RenderStory name="Render args missing" />

<Story
  name="Parameters"
  args={{ label: 'Label' }}
  parameters={{
    // @ts-expect-error layout must be a known value
    layout: 'nope',
    backgrounds: {
      // @ts-expect-error disable must be a boolean
      disable: 'yes',
    },
  }}
/>

<Story exportName="ExportName" args={{ label: 'Label' }} />

{/* @ts-expect-error name is missing */ null}
<Story args={{ label: 'Label' }} />

<Story extend="Required args" name="Extend without args" />

<Story extend="Required args" name="Extend with children" asChild>
  <p>Static content</p>
</Story>

<Story extend="Required args" name="Extend with template">
  {#snippet template(args, context)}
    {expectTypeOf(args.label).toEqualTypeOf<string>()}
    {expectTypeOf(context.args.disabled).toEqualTypeOf<boolean>()}
    <Button {...args} />
  {/snippet}
</Story>

<Story extend="Required args" name="Extend with static template">
  {#snippet template()}
    <p>Static content</p>
  {/snippet}
</Story>

<Story
  extend="Required args"
  name="Extend wrong arg type"
  args={{
    // @ts-expect-error label must be a string
    label: 1,
  }}
/>

{/* @ts-expect-error extend must be a string */ null}
<Story extend={1} name="Extend not a string" />
