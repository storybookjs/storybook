import { fn } from 'storybook/test';

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Callback = (...args: any[]) => Promise<any>;

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath = fn().mockName('next/cache::revalidatePath');
const revalidateTag = fn().mockName('next/cache::revalidateTag');
const updateTag = fn().mockName('next/cache::updateTag');
const unstable_cache = fn()
  .mockName('next/cache::unstable_cache')
  .mockImplementation((cb: Callback) => cb);
const unstable_noStore = fn().mockName('next/cache::unstable_noStore');
const refresh = fn().mockName('next/cache::refresh');

// mock utilities/overrides (as of Next v15.0.0)
const cacheLife = fn().mockName('next/cache::cacheLife');
const cacheTag = fn().mockName('next/cache::cacheTag');

const unstable_cacheLife = cacheLife;
const unstable_cacheTag = cacheTag;

const cacheExports = {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  updateTag,
  refresh,
  unstable_noStore,
  cacheLife,
  cacheTag,
  unstable_cacheLife,
  unstable_cacheTag,
};

export default cacheExports;
export {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  unstable_noStore,
  refresh,
  updateTag,
  cacheLife,
  cacheTag,
  unstable_cacheLife,
  unstable_cacheTag,
};
