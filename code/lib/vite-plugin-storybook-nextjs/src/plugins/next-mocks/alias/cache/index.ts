import { fn } from "storybook/test";
import type { Mock } from "vitest";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Callback = (...args: any[]) => Promise<any>;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Procedure = (...args: any[]) => any;

// mock utilities/overrides (as of Next v14.2.0)
const revalidatePath: Mock<Procedure> = fn().mockName(
  "next/cache::revalidatePath",
);
const revalidateTag: Mock<Procedure> = fn().mockName(
  "next/cache::revalidateTag",
);
const updateTag: Mock<Procedure> = fn().mockName("next/cache::updateTag");
const unstable_cache: Mock<Procedure> = fn()
  .mockName("next/cache::unstable_cache")
  .mockImplementation((cb: Callback) => cb);
const unstable_noStore: Mock<Procedure> = fn().mockName(
  "next/cache::unstable_noStore",
);
const refresh: Mock<Procedure> = fn().mockName("next/cache::refresh");

// mock utilities/overrides (as of Next v15.0.0)
const cacheLife: Mock<Procedure> = fn().mockName("next/cache::cacheLife");
const cacheTag: Mock<Procedure> = fn().mockName("next/cache::cacheTag");

// deprecated wrappers (as of Next v16.0.0)
const unstable_cacheLife: Mock<Procedure> = fn()
  .mockName("next/cache::unstable_cacheLife")
  .mockImplementation((...args) => cacheLife(...args));
const unstable_cacheTag: Mock<Procedure> = fn()
  .mockName("next/cache::unstable_cacheTag")
  .mockImplementation((...args) => cacheTag(...args));

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
