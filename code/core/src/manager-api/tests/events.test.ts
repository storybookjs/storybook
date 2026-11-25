import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEventMetadata } from '../lib/events.ts';
import type { API } from '../root.tsx';

describe('getEventMetadata', () => {
  const fullAPIMock = { findRef: vi.fn(), getRefs: vi.fn() };
  const fullAPI = fullAPIMock as unknown as API;

  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'http://localhost:6006', pathname: '/' });
  });

  it('returns local if the event source is the same current location', () => {
    expect(
      getEventMetadata({ type: 'event', source: 'http://localhost:6006' }, fullAPI)
    ).toMatchObject({
      sourceType: 'local',
    });
  });

  it('returns external if the refId is set', () => {
    fullAPIMock.getRefs.mockReset().mockReturnValue({
      ref: { id: 'ref' },
    });

    expect(
      getEventMetadata(
        { type: 'event', source: 'http://localhost:6006/foo/bar', refId: 'ref' },
        fullAPI
      )
    ).toMatchObject({
      sourceType: 'external',
      ref: { id: 'ref' },
    });
  });

  it('returns external if the source is set to something other and ref is unset (SB5)', () => {
    fullAPIMock.findRef.mockReset().mockReturnValue({ id: 'ref' });

    expect(
      getEventMetadata({ type: 'event', source: 'http://storybook.host' }, fullAPI)
    ).toMatchObject({
      sourceType: 'external',
      ref: { id: 'ref' },
    });
  });
});
