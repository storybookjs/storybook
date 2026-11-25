import { Foo } from '../Foo.ts';

export default {
  component: Foo,
  tags: [],
};

export const Story1 = {
  tags: ['!dev', '!manifest'],
};

export const Story2 = {
  tags: ['!manifest'],
};
