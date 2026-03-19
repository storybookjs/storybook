import * as headers from 'next/dist/server/request/headers.js';
import { fn } from 'storybook/test';

// re-exports of the actual module
export * from 'next/dist/server/request/headers.js';

// mock utilities/overrides (as of Next v14.2.0)
export { headers } from './headers';
export { cookies } from './cookies';

// passthrough mocks - keep original implementation but allow for spying
// In Next.js 14, draftMode is exported from 'next/dist/client/components/headers'
// In Next.js 15+, draftMode is exported from 'next/dist/server/request/draft-mode'
// The webpack alias handles this, but we need to avoid the top-level import
// to prevent build errors when the module doesn't exist
let originalDraftMode: any;
try {
  // This will be resolved by webpack alias to the correct location based on Next.js version
  originalDraftMode = require('next/dist/server/request/draft-mode').draftMode;
} catch {
  // Fallback to the location in the headers module (Next.js 14)
  originalDraftMode = (headers as any).draftMode;
}

const draftMode = fn(originalDraftMode).mockName('draftMode');
export { draftMode };
