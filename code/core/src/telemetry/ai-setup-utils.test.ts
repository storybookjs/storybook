import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import { isStoryCreatedByAISetup } from './ai-setup-utils.ts';

// Mock modules with spy pattern
vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    findConfigFile: vi.fn(),
  };
});

vi.mock('./detect-agent.ts', () => ({
  detectAgent: vi.fn(() => undefined),
}));

vi.mock('./event-cache.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./event-cache.ts')>();
  return {
    ...actual,
    getAiSetupPending: vi.fn(() => undefined),
  };
});

vi.mock('./index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index.ts')>();
  return {
    ...actual,
    telemetry: vi.fn(),
  };
});

// Import mocked modules for spy access
import { telemetry } from './index.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(telemetry).mockImplementation(async (_eventType, payloadOrFactory) => {
    if (typeof payloadOrFactory === 'function') {
      return payloadOrFactory();
    }
    return payloadOrFactory;
  });
});

describe('isStoryCreatedByAISetup', () => {
  it('returns true for stories with the ai-generated tag', () => {
    expect(
      isStoryCreatedByAISetup({
        type: 'story',
        title: 'Foo',
        tags: ['ai-generated', 'dev', 'play-fn'],
      } as IndexEntry)
    ).toBe(true);
  });

  it('returns false for regular stories', () => {
    expect(isStoryCreatedByAISetup({ type: 'story', title: 'Foo' } as IndexEntry)).toBe(false);
  });
});
