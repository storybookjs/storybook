import { draftMode as originalDraftMode } from 'next/dist/server/request/draft-mode.js';
import * as headers from 'next/dist/server/request/headers.js';
import { fn } from 'storybook/test';

// re-exports of the actual module
export * from 'next/dist/server/request/headers.js';

// mock utilities/overrides (as of Next v14.2.0)
export { headers } from './headers';
export { cookies } from './cookies';

// passthrough mocks - keep original implementation but allow for spying
const draftMode = fn(originalDraftMode ?? (headers as any).draftMode).mockName('draftMode');
export { draftMode };
