import { beforeEach, describe, expect, it, vi } from 'vitest';

const { codexCtorMock, startThreadMock, runStreamedMock } = vi.hoisted(() => ({
  codexCtorMock: vi.fn(),
  startThreadMock: vi.fn(),
  runStreamedMock: vi.fn(),
}));

vi.mock('@openai/codex-sdk', () => ({
  Codex: class MockCodex {
    constructor(opts?: unknown) {
      codexCtorMock(opts);
    }

    startThread(opts: unknown) {
      return startThreadMock(opts);
    }
  },
}));

import { codexAgent } from './codex.ts';

const logger = {
  log: vi.fn(),
  logStep: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
};

describe('codexAgent.execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    runStreamedMock.mockResolvedValue({
      events: (async function* () {
        yield {
          type: 'turn.completed',
          usage: {
            input_tokens: 10,
            cached_input_tokens: 2,
            output_tokens: 4,
          },
        };
      })(),
    });

    startThreadMock.mockReturnValue({
      runStreamed: runStreamedMock,
    });
  });

  it('passes STORYBOOK_DISABLE_TELEMETRY through the Codex CLI environment', async () => {
    await codexAgent.execute({
      prompt: 'prompt',
      projectPath: '/repo',
      variant: { agent: 'codex', model: 'gpt-5.4', effort: 'medium' },
      resultsDir: '/results',
      logger,
    });

    expect(codexCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        env: expect.objectContaining({
          STORYBOOK_DISABLE_TELEMETRY: '1',
        }),
      })
    );
  });

  it('starts the thread with the expected working directory and approval policy', async () => {
    await codexAgent.execute({
      prompt: 'prompt',
      projectPath: '/repo',
      variant: { agent: 'codex', model: 'gpt-5.4', effort: 'medium' },
      resultsDir: '/results',
      logger,
    });

    expect(startThreadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4',
        modelReasoningEffort: 'medium',
        workingDirectory: '/repo',
        approvalPolicy: 'never',
      })
    );
  });
});
