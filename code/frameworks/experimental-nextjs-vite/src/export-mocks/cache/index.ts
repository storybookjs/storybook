/* eslint-disable @typescript-eslint/naming-convention */
import { fn } from '@storybook/test';

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Callback = (...args: any[]) => Promise<any>;

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath = fn().mockName('next/cache::revalidatePath');
const revalidateTag = fn().mockName('next/cache::revalidateTag');
const unstable_cache = fn()
  .mockName('next/cache::unstable_cache')
  .mockImplementation((cb: Callback) => cb);
const unstable_noStore = fn().mockName('next/cache::unstable_noStore');

const cacheExports = {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  unstable_noStore,
};

export default cacheExports;
export { unstable_cache, revalidateTag, revalidatePath, unstable_noStore };
