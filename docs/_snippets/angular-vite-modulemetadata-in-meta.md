```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { moduleMetadata } from '@storybook/angular-vite';
import preview from '../.storybook/preview';

import { YourComponent } from './your.component';

const meta = preview.meta({
  component: YourComponent,
  decorators: [
    moduleMetadata({
      imports: [
        //...
      ],
      declarations: [
        //...
      ],
      providers: [
        //...
      ],
    }),
  ],
});

export const Base = meta.story();
```

```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular-vite';

import { YourComponent } from './your.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  decorators: [
    moduleMetadata({
      imports: [
        //...
      ],
      declarations: [
        //...
      ],
      providers: [
        //...
      ],
    }),
  ],
};
export default meta;

type Story = StoryObj<YourComponent>;

export const Base: Story = {};
```
