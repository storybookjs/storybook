import type { Meta, StoryObj } from '../../csf-types.ts';

import { Color } from './types.ts';
import { NamedTypePropsComponent } from './named-type-props.component.ts';

const meta = {
  title: 'AngularFixtures/NamedTypeProps',
  component: NamedTypePropsComponent,
} satisfies Meta<NamedTypePropsComponent>;

export default meta;

export const AllProps: StoryObj<NamedTypePropsComponent> = {
  args: {
    user: { name: 'Ada Lovelace', age: 36 },
    status: Color.Green,
    tree: { label: 'root' },
    id: 'sb-1',
    config: { collapsed: false },
  },
};
