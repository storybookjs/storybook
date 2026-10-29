import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from '@storybook/core/internal/channels';
import { Channel } from '@storybook/core/internal/channels';
import {
  AI_SETUP_ANALYTICS_REQUEST,
  AI_SETUP_ANALYTICS_RESPONSE,
} from '@storybook/core/internal/core-events';

import { initAIAnalyticsChannel } from './ai-setup-channel.ts';

vi.mock('@storybook/core/internal/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/core/internal/telemetry')>();
  return {
    ...actual,
    getLastEvents: vi.fn(),
    isStoryCreatedByAISetup: vi.fn(),
    telemetry: vi.fn(),
  };
});

vi.mock('@storybook/core/internal/deep/utils/ai-checklist-flags', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@storybook/core/internal/deep/utils/ai-checklist-flags')>();
  return {
    ...actual,
    getAiSetupRunId: vi.fn(),
  };
});

vi.mock(
  '@storybook/core/internal/deep/story-index/ghost-stories/run-story-tests',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@storybook/core/internal/deep/story-index/ghost-stories/run-story-tests')
      >();
    return {
      ...actual,
      runStoryTests: vi.fn(),
    };
  }
);

vi.mock('./wait-for-idle-vitest.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./wait-for-idle-vitest.ts')>();
  return {
    ...actual,
    waitForIdleVitest: vi.fn(),
  };
});

const mockTelemetry = await import('@storybook/core/internal/telemetry');
const mockAiChecklistFlags = await import('@storybook/core/internal/deep/utils/ai-checklist-flags');
const mockRunStoryTests =
  await import('@storybook/core/internal/deep/story-index/ghost-stories/run-story-tests');
const mockWaitForIdleVitest = await import('./wait-for-idle-vitest.ts');

const isReactStorybook = vi.fn(() => true);
const OPTIONS = { configDir: '/project/.storybook', isReactStorybook };

describe('initAIAnalyticsChannel', () => {
  const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
  const mockChannel = new Channel({ transport });
  const analyticsResponseListener = vi.fn();
  // to avoid noise in the test output
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    transport.setHandler.mockClear();
    transport.send.mockClear();
    analyticsResponseListener.mockClear();
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();

    mockChannel.removeAllListeners();

    vi.mocked(mockTelemetry.getLastEvents).mockReset();
    isReactStorybook.mockReset().mockReturnValue(true);
    vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReset();
    vi.mocked(mockTelemetry.telemetry).mockReset();
    vi.mocked(mockAiChecklistFlags.getAiSetupRunId).mockReset().mockResolvedValue(undefined);
    vi.mocked(mockRunStoryTests.runStoryTests).mockReset();
    vi.mocked(mockWaitForIdleVitest.waitForIdleVitest).mockReset().mockResolvedValue(true);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('no-op conditions', () => {
    it('should skip scoring when there is no lastAISetup event', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        init: { body: { sessionId: 'test-session' } },
      } as any);

      initAIAnalyticsChannel(mockChannel, OPTIONS);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
      expect(isReactStorybook).not.toHaveBeenCalled();
    });

    it('should skip scoring when lastSetupStoryScoringRun.runId matches lastAISetup.runId (same session)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);

      initAIAnalyticsChannel(mockChannel, OPTIONS);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
      expect(isReactStorybook).not.toHaveBeenCalled();
    });
  });

  describe('run conditions', () => {
    it('should run scoring when there is no lastSetupStoryScoringRun (first time)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(false);

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: { entries: {} },
        }),
      };

      initAIAnalyticsChannel(mockChannel, OPTIONS, () => Promise.resolve(mockGenerator as any));
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(isReactStorybook).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({ fileCount: 0, storyCount: 0 }),
        })
      );
    });

    it('should run scoring when lastSetupStoryScoringRun.runId differs from lastAISetup.runId (new ai-setup session)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-B' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(false);

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: { entries: {} },
        }),
      };

      initAIAnalyticsChannel(mockChannel, OPTIONS, () => Promise.resolve(mockGenerator as any));
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(isReactStorybook).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({ fileCount: 0, storyCount: 0 }),
        })
      );
    });

    it('should run scoring for AI-generated story files when they are found', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-B' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(true);
      vi.mocked(mockRunStoryTests.runStoryTests).mockResolvedValue({
        duration: 1234,
        summary: {
          total: 2,
          passed: 2,
          successRate: 1,
          successRateWithoutEmptyRender: 1,
          categorizedErrors: {},
          cssCheck: 'not-run',
          uniqueErrorCount: 0,
          passedButEmptyRender: 0,
        },
      } as any);
      vi.mocked(mockAiChecklistFlags.getAiSetupRunId).mockResolvedValue('session-B');

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: {
            entries: {
              'story-1': { importPath: './Button.stories.tsx', type: 'story' },
            },
          },
        }),
      };

      initAIAnalyticsChannel(mockChannel, OPTIONS, () => Promise.resolve(mockGenerator as any));
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockRunStoryTests.runStoryTests).toHaveBeenCalledWith(['./Button.stories.tsx']);
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({
            fileCount: 1,
            storyCount: 1,
            testRunDuration: 1234,
          }),
          runId: 'session-B',
          results: expect.objectContaining({ total: 2, passed: 2 }),
        })
      );
    });
  });

  describe('gating conditions', () => {
    it('should skip scoring when renderer is not React', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      isReactStorybook.mockReturnValue(false);

      initAIAnalyticsChannel(mockChannel, OPTIONS);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(isReactStorybook).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });

    it('should skip scoring when vitest addon is not present', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);

      // Only addon-vitest wires the handler, so without it nothing answers.
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(analyticsResponseListener).not.toHaveBeenCalled();
      expect(mockTelemetry.getLastEvents).not.toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });

    it('should skip scoring when vitest is not idle', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockWaitForIdleVitest.waitForIdleVitest).mockResolvedValue(false);

      initAIAnalyticsChannel(mockChannel, OPTIONS);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockRunStoryTests.runStoryTests).not.toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });
  });

  describe('error conditions', () => {
    it('should call telemetry with runError when an unexpected error occurs', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockRejectedValue(new Error('Cache error'));

      initAIAnalyticsChannel(mockChannel, OPTIONS);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          runError: 'Unknown error during AI story scoring',
        })
      );
    });
  });
});
