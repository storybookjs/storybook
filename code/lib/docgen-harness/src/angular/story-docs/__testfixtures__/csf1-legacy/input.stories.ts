import type { Meta, StoryFn } from '../../../csf-types.ts';

import { CsfOneLegacyComponent } from './csf1-legacy.component.ts';

const meta: Meta<CsfOneLegacyComponent> = {
  title: 'StoryDocs/csf1-legacy',
  component: CsfOneLegacyComponent,
};

export default meta;

const Template: StoryFn<CsfOneLegacyComponent> = (args) => ({ props: args });

/** Bound from a shared template. */
export const Bound = Template.bind({});
Bound.args = { label: 'Bound', count: 2 };
