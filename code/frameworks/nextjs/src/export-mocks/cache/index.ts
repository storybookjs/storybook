import { unstable_cache } from 'next/dist/server/web/spec-extension/unstable-cache';
import { unstable_noStore } from 'next/dist/server/web/spec-extension/unstable-no-store';
import { fn } from 'storybook/test';

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath = fn().mockName('next/cache::revalidatePath');
const revalidateTag = fn().mockName('next/cache::revalidateTag');

// Next v16.0.0
const updateTag = fn().mockName('next/cache::updateTag');
const refresh = fn().mockName('next/cache::refresh');

const cacheExports = {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  unstable_noStore,
  updateTag,
  refresh,
};

export default cacheExports;
export { unstable_cache, revalidateTag, revalidatePath, unstable_noStore, updateTag, refresh };
