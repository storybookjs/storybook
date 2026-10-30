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
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
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
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
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
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
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
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  }}
/>
```
