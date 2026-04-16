import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexEntry, StoryIndex } from 'storybook/internal/types';

import {
  checkPreviewChanged,
  collectAiSetupEvidence,
  countAiAuthoredStories,
  isStoryCreatedByAISetup,
} from './ai-setup-utils.ts';

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
import { findConfigFile } from 'storybook/internal/common';
import { readFile } from 'node:fs/promises';
import { detectAgent } from './detect-agent.ts';
import { getAiSetupPending } from './event-cache.ts';
import { SESSION_TIMEOUT } from './session-id.ts';
import { telemetry } from './index.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

const makePendingRecord = (overrides = {}) => ({
  timestamp: Date.now() - 60_000, // 1 minute ago
  sessionId: 'test-session-id',
  configDir: '/test/config',
  previewPath: '/test/config/preview.ts',
  previewHash: 'abc123',
  ...overrides,
});

const makeStoryIndex = (entries: Record<string, any> = {}): StoryIndex => ({
  v: 5,
  entries,
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

describe('countAiAuthoredStories', () => {
  it('counts correctly with mixed entries', () => {
    const index = makeStoryIndex({
      'ai-1': {
        type: 'story',
        title: 'AI Generated/Button',
        tags: ['ai-generated'],
        id: 'ai-1',
        name: 'Default',
        importPath: './ai.stories.ts',
      },
      'ai-2': {
        type: 'story',
        title: 'AI Generated/Card',
        tags: ['ai-generated'],
        id: 'ai-2',
        name: 'Default',
        importPath: './ai2.stories.ts',
      },
      regular: {
        type: 'story',
        title: 'Components/Input',
        id: 'regular',
        name: 'Default',
        importPath: './input.stories.ts',
      },
      docs: {
        type: 'docs',
        title: 'AI Generated/Docs',
        tags: ['ai-generated'],
        id: 'docs',
        name: 'Docs',
        importPath: './docs.mdx',
        storiesImports: [],
      },
    });
    // Only type: 'story' entries are counted, not docs
    expect(countAiAuthoredStories(index)).toBe(2);
  });

  it('returns 0 when no AI stories exist', () => {
    const index = makeStoryIndex({
      regular: {
        type: 'story',
        title: 'Components/Button',
        id: 'regular',
        name: 'Default',
        importPath: './button.stories.ts',
      },
    });
    expect(countAiAuthoredStories(index)).toBe(0);
  });
});

describe('checkPreviewChanged', () => {
  it('returns false when hash matches snapshot', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockResolvedValue('file content');

    // Pre-compute the expected hash
    const { createHash } = await import('node:crypto');
    const expectedHash = createHash('sha256').update('file content').digest('hex');

    const result = await checkPreviewChanged('/test/config', {
      previewPath: '/test/config/preview.ts',
      previewHash: expectedHash,
    });
    expect(result).toBe(false);
  });

  it('returns true when hash differs from snapshot', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockResolvedValue('modified content');

    const result = await checkPreviewChanged('/test/config', {
      previewPath: '/test/config/preview.ts',
      previewHash: 'some-old-hash',
    });
    expect(result).toBe(true);
  });

  it('returns true when preview file is missing or unreadable', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.ts');
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    const result = await checkPreviewChanged('/test/config', {
      previewPath: '/test/config/preview.ts',
      previewHash: 'some-hash',
    });
    expect(result).toBe(true);
  });

  it('returns true when file path changed', async () => {
    vi.mocked(findConfigFile).mockReturnValue('/test/config/preview.tsx');

    const result = await checkPreviewChanged('/test/config', {
      previewPath: '/test/config/preview.ts',
      previewHash: 'hash',
    });
    expect(result).toBe(true);
  });
});

describe('collectAiSetupEvidence', () => {
  it('does not fire when no agent detected', async () => {
    vi.mocked(detectAgent).mockReturnValue(undefined);

    await collectAiSetupEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when no pending record', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(undefined);

    await collectAiSetupEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when pending record is expired', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(
      makePendingRecord({ timestamp: Date.now() - SESSION_TIMEOUT - 1000 })
    );

    await collectAiSetupEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('does not fire when configDir does not match', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    vi.mocked(getAiSetupPending).mockResolvedValue(
      makePendingRecord({ configDir: '/other/project/.storybook' })
    );

    await collectAiSetupEvidence('dev', '/test/config');
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('fires event with correct payload when all gates pass', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({ configDir: '/test/config' });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(pending.previewPath);
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

    await collectAiSetupEvidence('dev', '/test/config');

    expect(telemetry).toHaveBeenCalledWith(
      'ai-setup-evidence',
      expect.any(Function),
      expect.objectContaining({
        immediate: true,
        configDir: '/test/config',
      })
    );

    const factory = vi.mocked(telemetry).mock.calls[0][1] as () => Promise<unknown>;
    await expect(factory()).resolves.toMatchObject({
      previewChanged: true,
      aiAuthoredStories: undefined,
      sessionId: 'test-session-id',
    });
  });

  it('reports aiAuthoredStories as undefined when no story index provided', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({ configDir: '/test/config' });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(null);

    await collectAiSetupEvidence('dev', '/test/config');

    expect(telemetry).toHaveBeenCalledWith(
      'ai-setup-evidence',
      expect.any(Function),
      expect.anything()
    );

    const factory = vi.mocked(telemetry).mock.calls[0][1] as () => Promise<unknown>;
    await expect(factory()).resolves.toMatchObject({
      aiAuthoredStories: undefined,
    });
  });

  it('counts aiAuthoredStories when story index provided', async () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'claude' });
    const pending = makePendingRecord({
      configDir: '/test/config',
      previewFile: null,
      previewHash: null,
    });
    vi.mocked(getAiSetupPending).mockResolvedValue(pending);
    vi.mocked(findConfigFile).mockReturnValue(null);

    const storyIndex = makeStoryIndex({
      'ai-1': {
        type: 'story',
        title: 'AI Generated/Button',
        tags: ['ai-generated'],
        id: 'ai-1',
        name: 'Default',
        importPath: './ai.stories.ts',
      },
      regular: {
        type: 'story',
        title: 'Components/Input',
        id: 'regular',
        name: 'Default',
        importPath: './input.stories.ts',
      },
    });

    await collectAiSetupEvidence('dev', '/test/config', storyIndex);

    expect(telemetry).toHaveBeenCalledWith(
      'ai-setup-evidence',
      expect.any(Function),
      expect.anything()
    );

    const factory = vi.mocked(telemetry).mock.calls[0][1] as () => Promise<unknown>;
    await expect(factory()).resolves.toMatchObject({
      aiAuthoredStories: 1,
    });
  });
});
