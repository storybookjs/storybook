import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { loaders } from './loaders.ts';

vi.mock('storybook/preview-api', { spy: true });

const channel = { emit: vi.fn() };

beforeEach(() => {
  vi.mocked(addons.getChannel).mockReturnValue(channel as any);
});

describe('loaders', () => {
  it('emits each mock call argument to the action channel, not the args array', () => {
    loaders[0]({ parameters: {} } as any);

    // a real storybook/test spy exercises the actual onMockCall wiring —
    // no storybook/test mock needed (and { spy: true } can't wrap its
    // chai-proxied `expect` export anyway)
    const spy = fn().mockName('onClick');
    const event = { type: 'click' };
    spy(event);

    expect(channel.emit).toHaveBeenCalledOnce();
    expect(channel.emit.mock.calls[0][1].data.args).toBe(event);
  });

  it('forwards multiple mock-call arguments in order', () => {
    loaders[0]({ parameters: {} } as any);

    const spy = fn().mockName('onClick');
    const event = { type: 'click' };
    spy(event, 'extra', 42);

    expect(channel.emit).toHaveBeenCalledOnce();
    expect(channel.emit.mock.calls[0][1].data.args).toEqual([event, 'extra', 42]);
  });
});
