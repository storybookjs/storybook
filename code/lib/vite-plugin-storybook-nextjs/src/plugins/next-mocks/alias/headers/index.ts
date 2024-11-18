import { fn } from "@storybook/test";
import { draftMode as originalDraftMode } from "next/dist/server/request/draft-mode";
import * as headers from "next/dist/server/request/headers";
import type { Mock } from "vitest";

// mock utilities/overrides (as of Next v14.2.0)
export { headers } from "./headers";
export { cookies } from "./cookies";

// re-exports of the actual module
export * from "next/dist/server/request/headers";

// passthrough mocks - keep original implementation but allow for spying
const draftMode: Mock<() => ReturnType<typeof originalDraftMode>> = fn(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  originalDraftMode ?? (headers as any).draftMode,
).mockName("draftMode");
export { draftMode };
