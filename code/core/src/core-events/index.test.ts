import { describe, expect, it } from 'vitest';

import * as EventsPackageExport from './index';
import EventsDefaultExport, { CHANNEL_CREATED } from './index';

describe('Core Events', () => {
  it('Should export the module as a namespace', () => {
    expect(EventsPackageExport.CHANNEL_CREATED).toBe('channelCreated');
  });
  it('Should export all values in the default export', () => {
    // this is intentional, for testing purposes

    expect(EventsDefaultExport.CHANNEL_CREATED).toBe('channelCreated');
  });
  it('Should export values as named exports', () => {
    expect(CHANNEL_CREATED).toBe('channelCreated');
  });
});
