import type { Meta, StoryObj } from '../../csf-types.ts';

import { JsdocTagsComponent } from './jsdoc-tags.component.ts';

const meta = {
  title: 'AngularFixtures/JsdocTags',
  component: JsdocTagsComponent,
} satisfies Meta<JsdocTagsComponent>;

export default meta;

export const PropsAsWritten: StoryObj<JsdocTagsComponent> = {
  args: { text: 'Deployed', accent: 'seagreen' },
};
