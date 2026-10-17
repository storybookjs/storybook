import type { AxeResults } from 'axe-core';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/preview-api';

import { EVENTS } from './constants.ts';

const { axeMock, documentMock } = vi.hoisted(() => {
  const documentMock = {
    body: {},
    getElementById: vi.fn(),
    location: { pathname: '/iframe.html' },
  };

  return {
    documentMock,
    axeMock: {
      reset: vi.fn(),
      configure: vi.fn(),
      run: vi.fn(),
    },
  };
});

vi.mock('@storybook/global', () => ({
  global: {
    document: documentMock,
  },
}));

vi.mock('axe-core', () => ({
  default: axeMock,
}));

vi.mock('storybook/preview-api');
const mockedAddons = vi.mocked(addons);

const axeResults = {
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: [],
} as Partial<AxeResults> as AxeResults;

describe('a11yRunner', () => {
  let mockChannel: { on: Mock; emit?: Mock };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    documentMock.getElementById.mockReturnValue(null);
    axeMock.run.mockResolvedValue(axeResults);

    mockChannel = { on: vi.fn(), emit: vi.fn() };
    mockedAddons.getChannel.mockReturnValue(
      mockChannel as unknown as ReturnType<typeof addons.getChannel>
    );
  });

  it('should listen to events', async () => {
    await import('./a11yRunner.ts');

    expect(mockedAddons.getChannel).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(EVENTS.MANUAL, expect.any(Function));
  });

  it('passes disabled configured rules to axe.run when runOnly is present', async () => {
    const { run } = await import('./a11yRunner.ts');
    const input = {
      config: {
        rules: [
          { id: 'target-size', enabled: false },
          { id: 'color-contrast', enabled: true },
        ],
      },
      options: {
        runOnly: ['wcag2a'],
        rules: {
          'button-name': { enabled: false },
        },
      },
    };

    await run(input, 'example-story');

    expect(axeMock.configure).toHaveBeenCalledWith({
      rules: [
        { id: 'region', enabled: false },
        { id: 'target-size', enabled: false },
        { id: 'color-contrast', enabled: true },
      ],
    });
    expect(axeMock.run).toHaveBeenCalledWith(expect.any(Object), {
      runOnly: ['wcag2a'],
      rules: {
        region: { enabled: false },
        'target-size': { enabled: false },
        'button-name': { enabled: false },
      },
    });
    expect(axeMock.run.mock.calls[0][1]).not.toBe(input.options);
    expect(input.options).toEqual({
      runOnly: ['wcag2a'],
      rules: {
        'button-name': { enabled: false },
      },
    });
  });

  it('respects configured rule overrides when collecting disabled rules', async () => {
    const { run } = await import('./a11yRunner.ts');

    await run(
      {
        config: {
          rules: [{ id: 'region', enabled: true }],
        },
        options: {
          runOnly: ['wcag2a'],
        },
      },
      'example-story'
    );

    expect(axeMock.run).toHaveBeenCalledWith(expect.any(Object), {
      runOnly: ['wcag2a'],
    });
  });
});
