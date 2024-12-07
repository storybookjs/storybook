import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';

import { DEFAULT_NAME, ITEMS, TokenComponent } from './angular-src/token.component';

export const Story1: StoryFn = () => ({
  template: `<storybook-simple-token-component [name]="name"></storybook-simple-token-component>`,
  props: {
    name: 'Prop Name',
  },
});

Story1.storyName = 'Story 1';

export const Story2: StoryFn = () => ({
  template: `<storybook-simple-token-component></storybook-simple-token-component>`,
});

Story2.storyName = 'Story 2';

export default {
  // title: 'Core / ModuleMetadata / In export default with decorator',
  component: Story1,
  decorators: [
    moduleMetadata({
      imports: [],
      declarations: [TokenComponent],
      providers: [
        {
          provide: ITEMS,
          useValue: ['Joe', 'Jane'],
        },
        {
          provide: DEFAULT_NAME,
          useValue: 'Provider Name',
        },
      ],
    }),
  ],
} as Meta;
