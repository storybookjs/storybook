import { fn } from 'storybook/test';
import type { Mock } from 'vitest';

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Callback = (...args: any[]) => Promise<any>;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Procedure = (...args: any[]) => any;

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath: Mock<Procedure> = fn().mockName('next/cache::revalidatePath');
const revalidateTag: Mock<Procedure> = fn().mockName('next/cache::revalidateTag');
const updateTag: Mock<Procedure> = fn().mockName('next/cache::updateTag');
const unstable_cache: Mock<Procedure> = fn()
  .mockName('next/cache::unstable_cache')
  .mockImplementation((cb: Callback) => cb);
const unstable_noStore: Mock<Procedure> = fn().mockName('next/cache::unstable_noStore');
const refresh: Mock<Procedure> = fn().mockName('next/cache::refresh');

// mock utilities/overrides (as of Next v16.3.0)
const io: Mock<Procedure> = fn(async () => {}).mockName('next/cache::io');

// mock utilities/overrides (as of Next v16.4.0)
const navigation: Mock<Procedure> = fn(async () => {}).mockName('next/cache::navigation');
const prefetch: Mock<Procedure> = fn(async () => {}).mockName('next/cache::prefetch');

// mock utilities/overrides (as of Next v15.0.0)
const cacheLife: Mock<Procedure> = fn().mockName('next/cache::cacheLife');
const cacheTag: Mock<Procedure> = fn().mockName('next/cache::cacheTag');

const unstable_cacheLife = cacheLife;
const unstable_cacheTag = cacheTag;

const cacheExports = {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  updateTag,
  refresh,
  io,
  navigation,
  prefetch,
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
  io,
  navigation,
  prefetch,
  updateTag,
  cacheLife,
  cacheTag,
  unstable_cacheLife,
  unstable_cacheTag,
};
