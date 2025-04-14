```js filename="Page.stories.js" renderer="common" language="js"
import MockDate from 'mockdate';

// ...rest of story file

export const ChristmasUI = {
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts-4-9"
import MockDate from 'mockdate';

// ...rest of story file

export const ChristmasUI: Story = {
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
};
```

```ts filename="Page.stories.ts" renderer="common" language="ts"
import MockDate from 'mockdate';

// ...rest of story file

export const ChristmasUI: Story = {
  async play({ mount }) {
    MockDate.set('2024-12-25');
    // 👇 Render the component with the mocked date
    await mount();
    // ...rest of test
  },
};
```
