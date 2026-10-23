```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  import { defineMeta } from '@storybook/sveltekit';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  import { defineMeta } from '@storybook/sveltekit';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  }}
/>
```
