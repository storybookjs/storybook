import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/preview-api';
import { onMockCall } from 'storybook/test';

import { loaders } from './loaders.ts';

vi.mock('storybook/preview-api', { spy: true });
// { spy: true } can't be used here: the real `storybook/test` exports a
// chai-proxied `expect` that throws `Invalid Chai property` when vitest's spy
// machinery inspects it. Keep the real exports and stub just `onMockCall`.
vi.mock('storybook/test', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/test')>()),
  onMockCall: vi.fn(),
}));

const channel = { emit: vi.fn() };

beforeEach(() => {
  vi.mocked(addons.getChannel).mockReturnValue(channel as any);
});

describe('loaders', () => {
  it('emits each mock call argument to the action channel, not the args array', () => {
    loaders[0]({ parameters: {} } as any);

    expect(onMockCall).toHaveBeenCalledOnce();
    const onCall = vi.mocked(onMockCall).mock.calls[0][0];

    const event = { type: 'click' };
    onCall({ getMockName: () => 'onClick' } as any, [event]);

    expect(channel.emit).toHaveBeenCalledOnce();
    expect(channel.emit.mock.calls[0][1].data.args).toBe(event);
  });
});
