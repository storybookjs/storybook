import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/internal/preview-api';

import { EVENTS } from './constants';

vi.mock('storybook/internal/preview-api');
const mockedAddons = vi.mocked(addons);

describe('a11yRunner', () => {
  let mockChannel: { on: Mock; emit?: Mock };

  beforeEach(() => {
    mockedAddons.getChannel.mockReset();

    mockChannel = { on: vi.fn(), emit: vi.fn() };
    mockedAddons.getChannel.mockReturnValue(mockChannel as any);
  });

  it('should listen to events', async () => {
    await import('./a11yRunner');

    expect(mockedAddons.getChannel).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(EVENTS.REQUEST, expect.any(Function));
    expect(mockChannel.on).toHaveBeenCalledWith(EVENTS.MANUAL, expect.any(Function));
  });
});
