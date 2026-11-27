<script module lang="ts">
  import { expectTypeOf } from 'vitest';

  import type { Args, Decorator } from '../../public-types.ts';

  import preview from './preview.ts';
  import Button from '../Button.svelte';

  const meta = preview.meta({ component: Button, args: { disabled: false } });
  const { Story } = meta;
  const { Story: IconStory } = meta.type<{ args: { icon: 'star' | 'heart' } }>();
  const { Story: RequiredIconStory } = meta.type<{ args: { icon: string } }>();
  const { Story: OptionalIconStory } = meta.type<{ args: { icon?: string } }>();
  const { Story: DisabledStory } = meta.type<{ args: { disabled: true } }>();

  const complete = preview.meta({ component: Button, args: { label: 'Hi', disabled: false } });
  const { Story: CompleteOptionalStory } = complete.type<{ args: { icon?: string } }>();
  const { Story: CompleteRequiredStory } = complete.type<{ args: { icon: string } }>();

  const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => Story();
  const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
    component: Button,
    decorators: [withTheme],
    args: { locale: 'nl', disabled: false },
  });
  const { Story: ComposedStory } = typedMeta
    .type<{ args: { icon: string } }>()
    .type<{ args: { size: number } }>();
</script>

<!-- adds an arg to the args and the template of that story only -->

<IconStory
  name="Icon"
  args={{ label: 'Hi', icon: 'star' }}
  play={async ({ args }) => {
    expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
  }}
>
  {#snippet template(args)}
    {expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>()}
    {expectTypeOf(args.label).toEqualTypeOf<string>()}
    <Button {...args} />
  {/snippet}
</IconStory>

<Story name="No icon" args={{ label: 'Hi' }}>
  {#snippet template(args)}
    {expectTypeOf(args).not.toHaveProperty('icon')}
    <Button {...args} />
  {/snippet}
</Story>

<IconStory
  name="Wrong icon"
  args={{
    label: 'Hi',
    // @ts-expect-error icon must be 'star' | 'heart'
    icon: 'x',
  }}
/>

{#snippet iconTemplate(args: Args<typeof IconStory>)}
  {expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>()}
  <Button {...args} />
{/snippet}

<IconStory name="Shared icon template" template={iconTemplate} args={{ label: 'Hi', icon: 'heart' }} />

<!-- a required key is required on that component only -->

{/* @ts-expect-error icon is required */ null}
<RequiredIconStory name="Icon missing" args={{ label: 'Hi' }} />

<OptionalIconStory name="Optional icon" args={{ label: 'Hi' }} />

<Story name="Other story" args={{ label: 'Hi' }} />

<!-- args set in meta stay optional and the others stay required -->

<RequiredIconStory name="Meta arg not set" args={{ label: 'Hi', icon: 'star' }} />

<RequiredIconStory name="Meta arg set" args={{ label: 'Hi', icon: 'star', disabled: true }} />

{/* @ts-expect-error label is required */ null}
<RequiredIconStory name="Label missing" args={{ icon: 'star' }} />

<!-- an arg of the meta that type<>() declares again must be set again -->

{/* @ts-expect-error disabled is required, the meta sets it to false */ null}
<DisabledStory name="Redeclared arg missing" args={{ label: 'Hi' }} />

<DisabledStory name="Redeclared arg set" args={{ label: 'Hi', disabled: true }} />

<!-- no args are needed when no required arg is left or the content takes no args -->

<CompleteOptionalStory name="Complete" />

{/* @ts-expect-error icon is required */ null}
<CompleteRequiredStory name="Complete icon missing" />

<CompleteRequiredStory name="Complete as child" asChild>
  <p>Static content</p>
</CompleteRequiredStory>

<CompleteRequiredStory name="Complete template without parameters">
  {#snippet template()}
    <p>Static content</p>
  {/snippet}
</CompleteRequiredStory>

<!-- composes with preview.type<>(), decorators and itself -->

<ComposedStory
  name="Composed"
  args={{ label: 'Hi', theme: 'dark', icon: 'star', size: 1 }}
  play={async ({ args }) => {
    expectTypeOf(args.locale).toEqualTypeOf<'en' | 'nl'>();
    expectTypeOf(args.theme).toEqualTypeOf<'light' | 'dark'>();
    expectTypeOf(args.icon).toEqualTypeOf<string>();
    expectTypeOf(args.size).toEqualTypeOf<number>();
  }}
/>

{/* @ts-expect-error size is required */ null}
<ComposedStory name="Composed size missing" args={{ label: 'Hi', theme: 'dark', icon: 'star' }} />
