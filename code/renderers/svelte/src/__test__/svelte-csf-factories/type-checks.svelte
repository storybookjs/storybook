<script module lang="ts">
  import { expectTypeOf } from 'vitest';

  import type { Args } from '../../public-types.ts';

  import preview from './preview.ts';
  import Button from '../Button.svelte';
  import Layout from '../Layout.svelte';

  // svelte-check fails on each `@ts-expect-error` without an error. This isn't a stories file,
  // because it has more than one meta.
  const { Story } = preview.meta({ component: Button, args: { disabled: false } });
  const { Story: LayoutStory } = preview.meta({ component: Layout });
  const { Story: RenderStory } = preview.meta({ render: textTemplate });
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
