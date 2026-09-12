import { describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/preview-api';
import { onMockCall } from 'storybook/test';

import { loaders } from './loaders.ts';

vi.mock('storybook/preview-api');
vi.mock('storybook/test', () => ({ onMockCall: vi.fn() }));

const createChannel = () => {
  const channel = { emit: vi.fn() };
  vi.mocked(addons.getChannel).mockReturnValue(channel as any);
  return channel;
};

describe('loaders', () => {
  it('emits each mock call argument to the action channel, not the args array', () => {
    const channel = createChannel();
    loaders[0]({ parameters: {} } as any);

    expect(onMockCall).toHaveBeenCalledOnce();
    const onCall = vi.mocked(onMockCall).mock.calls[0][0];

    const event = { type: 'click' };
    onCall({ getMockName: () => 'onClick' } as any, [event]);

    expect(channel.emit).toHaveBeenCalledOnce();
    expect(channel.emit.mock.calls[0][1].data.args).toBe(event);
  });
});
