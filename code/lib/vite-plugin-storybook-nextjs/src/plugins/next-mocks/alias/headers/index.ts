import { draftMode as originalDraftMode } from 'next/dist/server/request/draft-mode';
import * as headersModule from 'next/dist/server/request/headers';
import { fn } from 'storybook/test';

// mock utilities/overrides (as of Next v14.2.0)
export { headers } from './headers.ts';
export { cookies } from './cookies.ts';

// passthrough mocks - keep original implementation but allow for spying
const draftMode = fn(
  // draftMode lived on the headers module in older Next versions
  originalDraftMode ?? (headersModule as { draftMode?: typeof originalDraftMode }).draftMode
).mockName('draftMode');
export { draftMode };
