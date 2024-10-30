import { fn } from '@storybook/test';

import * as originalHeaders from 'next/dist/client/components/headers';

// re-exports of the actual module
export * from 'next/dist/client/components/headers';

// mock utilities/overrides (as of Next v14.2.0)
export { headers } from './headers';
export { cookies } from './cookies';

// passthrough mocks - keep original implementation but allow for spying
const draftMode = fn(originalHeaders.draftMode).mockName('draftMode');
export { draftMode };
