import { Foo } from '../Foo.ts';

export default {
  component: Foo,
  tags: ['autodocs'],
};

export const Story1 = {
  tags: ['!dev', '!manifest'],
};

export const Story2 = {
  tags: [],
};
