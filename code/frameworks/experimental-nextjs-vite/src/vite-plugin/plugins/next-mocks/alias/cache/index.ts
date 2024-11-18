/* eslint-disable @typescript-eslint/naming-convention */
import type { Mock } from 'vitest';

import { fn } from '@storybook/test';

type Callback = (...args: any[]) => Promise<any>;

type Procedure = (...args: any[]) => any;

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath: Mock<Procedure> = fn().mockName('next/cache::revalidatePath');
const revalidateTag: Mock<Procedure> = fn().mockName('next/cache::revalidateTag');
const unstable_cache: Mock<Procedure> = fn()
  .mockName('next/cache::unstable_cache')
  .mockImplementation((cb: Callback) => cb);
const unstable_noStore: Mock<Procedure> = fn().mockName('next/cache::unstable_noStore');

const cacheExports = {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  unstable_noStore,
};

export default cacheExports;
export { unstable_cache, revalidateTag, revalidatePath, unstable_noStore };
