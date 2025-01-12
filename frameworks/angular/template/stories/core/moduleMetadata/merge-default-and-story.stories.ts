import { Meta, StoryFn, moduleMetadata } from '@storybook/angular';

import { CustomPipePipe } from './angular-src/custom.pipe';
import { DEFAULT_NAME, ITEMS, TokenComponent } from './angular-src/token.component';

export const MergeWithDefaultModuleMetadata: StoryFn = () => ({
  template: `<storybook-simple-token-component [name]="name | customPipe"></storybook-simple-token-component>`,
  props: {
    name: 'Prop Name',
  },
  moduleMetadata: {
    declarations: [CustomPipePipe],
    providers: [],
  },
});
MergeWithDefaultModuleMetadata.storyName = 'Merge with default ModuleMetadata';

export default {
  // title: 'Core / ModuleMetadata / Merge default and story',
  component: MergeWithDefaultModuleMetadata,
  decorators: [
    moduleMetadata({
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
