```svelte filename="BackLink.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';

  import preview from '../.storybook/preview';

  import BackLink from './BackLink.svelte';

  const { Story } = preview.meta({
    component: BackLink,
  });
</script>

<!-- 👇 By default, afterNavigate callbacks receive { type: 'enter', from: null, to: null } -->
<Story name="Direct visit" />

<Story
  name="From search"
  beforeEach={() => {
    // 👇 The navigation that afterNavigate callbacks receive when the component mounts
    setAfterNavigate({
      type: 'link',
      from: { url: new URL('http://localhost/search?q=shoes') },
    });
  }}
/>
```

```svelte filename="BackLink.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';

  import { defineMeta } from '@storybook/sveltekit';

  import BackLink from './BackLink.svelte';

  const { Story } = defineMeta({
    component: BackLink,
  });
</script>

<!-- 👇 By default, afterNavigate callbacks receive { type: 'enter', from: null, to: null } -->
<Story name="Direct visit" />

<Story
  name="From search"
  beforeEach={() => {
    // 👇 The navigation that afterNavigate callbacks receive when the component mounts
    setAfterNavigate({
      type: 'link',
      from: { url: new URL('http://localhost/search?q=shoes') },
    });
  }}
/>
```

```svelte filename="BackLink.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';

  import preview from '../.storybook/preview';

  import BackLink from './BackLink.svelte';

  const { Story } = preview.meta({
    component: BackLink,
  });
</script>

<!-- 👇 By default, afterNavigate callbacks receive { type: 'enter', from: null, to: null } -->
<Story name="Direct visit" />

<Story
  name="From search"
  beforeEach={() => {
    // 👇 The navigation that afterNavigate callbacks receive when the component mounts
    setAfterNavigate({
      type: 'link',
      from: { url: new URL('http://localhost/search?q=shoes') },
    });
  }}
/>
```

```svelte filename="BackLink.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  import { setAfterNavigate } from '@storybook/sveltekit/navigation.mock';

  import { defineMeta } from '@storybook/sveltekit';

  import BackLink from './BackLink.svelte';

  const { Story } = defineMeta({
    component: BackLink,
  });
</script>

<!-- 👇 By default, afterNavigate callbacks receive { type: 'enter', from: null, to: null } -->
<Story name="Direct visit" />

<Story
  name="From search"
  beforeEach={() => {
    // 👇 The navigation that afterNavigate callbacks receive when the component mounts
    setAfterNavigate({
      type: 'link',
      from: { url: new URL('http://localhost/search?q=shoes') },
    });
  }}
/>
```
