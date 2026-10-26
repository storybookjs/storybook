```ts filename="YourPage.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import { DocumentScreen } from './your-page.component';

const meta = preview.meta({
  component: DocumentScreen,
});

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```ts filename="YourPage.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-document-screen',
});

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import { http, HttpResponse, delay } from 'msw';

  import DocumentScreen  from './YourPage.svelte';

  const { Story } = preview.meta({
    component: DocumentScreen,
  });

  // 👇 The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: "approved",
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  }}
/>

<Story
  name="MockedError"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  }}
/>
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { http, HttpResponse, delay } from 'msw';

  import DocumentScreen  from './YourPage.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
  });

  // 👇 The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: "approved",
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  }}
/>

<Story
  name="MockedError"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  }}
/>
```

```js filename="YourPage.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-document-screen',
});

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import { http, HttpResponse, delay } from 'msw';

  import DocumentScreen  from './YourPage.svelte';

  const { Story } = preview.meta({
    component: DocumentScreen,
  });

  // 👇 The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: "approved",
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  }}
/>

<Story
  name="MockedError"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  }}
/>
```

```svelte filename="YourPage.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import { http, HttpResponse, delay } from 'msw';

  import DocumentScreen  from './YourPage.svelte';

  const { Story } = defineMeta({
    component: DocumentScreen,
  });

  // 👇 The mocked data that will be used in the story
  const TestData = {
    user: {
      userID: 1,
      name: 'Someone',
    },
    document: {
      id: 1,
      userID: 1,
      title: 'Something',
      brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      status: 'approved',
    },
    subdocuments: [
      {
        id: 1,
        userID: 1,
        title: 'Something',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        status: "approved",
      },
    ],
  };
</script>

<Story
  name="MockedSuccess"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  }}
/>

<Story
  name="MockedError"
  beforeEach={({ msw }) => {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  }}
/>
```

```ts filename="YourPage.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

const meta = preview.meta({
  component: DocumentScreen,
});

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```js filename="YourPage.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import { DocumentScreen } from './YourPage';

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

const meta = preview.meta({
  component: DocumentScreen,
});

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```ts filename="YourPage.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import DocumentScreen from './YourPage.vue';

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

const meta = preview.meta({
  component: DocumentScreen,
});

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```ts filename="YourPage.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { http, HttpResponse, delay } from 'msw';

import type { Meta, StoryObj } from '@storybook/angular';

import { DocumentScreen } from './your-page.component';

const meta: Meta<DocumentScreen> = {
  component: DocumentScreen,
};

export default meta;
type Story = StoryObj<DocumentScreen>;

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
};

export const MockedError: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
};
```

```js filename="YourPage.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import { http, HttpResponse, delay } from 'msw';

import preview from '../.storybook/preview';

import DocumentScreen from './YourPage.vue';

const meta = preview.meta({
  component: DocumentScreen,
});

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
});

export const MockedError = meta.story({
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
});
```

```ts filename="YourPage.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { http, HttpResponse, delay } from 'msw';

import { DocumentScreen } from './YourPage';

const meta = {
  component: DocumentScreen,
} satisfies Meta<typeof DocumentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
};

export const MockedError: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
};
```

```js filename="YourPage.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { http, HttpResponse, delay } from 'msw';

import { DocumentScreen } from './YourPage';

export default {
  component: DocumentScreen,
};

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
};

export const MockedError = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
};
```

```ts filename="YourPage.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { http, HttpResponse, delay } from 'msw';

const meta: Meta = {
  component: 'demo-document-screen',
};

export default meta;
type Story = StoryObj;

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
};

export const MockedError: Story = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
};
```

```js filename="YourPage.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { http, HttpResponse, delay } from 'msw';

export default {
  component: 'demo-document-screen',
};

// 👇 The mocked data that will be used in the story
const TestData = {
  user: {
    userID: 1,
    name: 'Someone',
  },
  document: {
    id: 1,
    userID: 1,
    title: 'Something',
    brief: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    status: 'approved',
  },
  subdocuments: [
    {
      id: 1,
      userID: 1,
      title: 'Something',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      status: 'approved',
    },
  ],
};

export const MockedSuccess = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint/', () => {
        return HttpResponse.json(TestData);
      }),
    );
  },
};

export const MockedError = {
  beforeEach({ msw }) {
    msw.use(
      http.get('https://your-restful-endpoint', async () => {
        await delay(800);
        return new HttpResponse(null, {
          status: 403,
        });
      }),
    );
  },
};
```
