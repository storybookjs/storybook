import preview from '#.storybook/preview';

import { Foo } from '../Foo.ts';

const meta = preview.meta({
  component: Foo,
  tags: ['autodocs'],
});

export const Story1 = meta.story({
  tags: [],
});

Story1.test('renders', async () => {});
