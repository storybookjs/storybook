import { describe, expect, it, vi, beforeEach } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { claudeAgent } from './claude-code.ts';

const logger = {
  log: vi.fn(),
  logStep: vi.fn(),
  logSuccess: vi.fn(),
  logError: vi.fn(),
};

describe('claudeAgent.execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not pass maxTurns to the Claude SDK query', async () => {
    queryMock.mockImplementation(async function* () {
      yield {
        type: 'result',
        subtype: 'success',
        num_turns: 2,
        total_cost_usd: 0.42,
        duration_api_ms: 4000,
      };
    });

    await claudeAgent.execute({
      prompt: 'prompt',
      projectPath: '/repo',
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'medium' },
      resultsDir: '/results',
      logger,
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.not.objectContaining({
          maxTurns: expect.anything(),
        }),
      })
    );
  });

  it('passes STORYBOOK_DISABLE_TELEMETRY through the Claude SDK environment', async () => {
    queryMock.mockImplementation(async function* () {
      yield {
        type: 'result',
        subtype: 'success',
        num_turns: 1,
        total_cost_usd: 0.1,
        duration_api_ms: 1000,
      };
    });

    await claudeAgent.execute({
      prompt: 'prompt',
      projectPath: '/repo',
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'medium' },
      resultsDir: '/results',
      logger,
    });

    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          env: expect.objectContaining({
            STORYBOOK_DISABLE_TELEMETRY: '1',
          }),
        }),
      })
    );
  });

  it('preserves terminal result metadata for non-success Claude results', async () => {
    queryMock.mockImplementation(async function* () {
      yield {
        type: 'result',
        subtype: 'error_max_turns',
        num_turns: 51,
        total_cost_usd: 1.3491844,
        duration_api_ms: 490424,
      };
    });

    const result = await claudeAgent.execute({
      prompt: 'prompt',
      projectPath: '/repo',
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'medium' },
      resultsDir: '/results',
      logger,
    });

    expect(result.execution).toMatchObject({
      turns: 51,
      cost: 1.3491844,
      durationApi: 490.424,
      terminalResultSubtype: 'error_max_turns',
    });
    expect(result.transcript).toEqual([
      expect.objectContaining({
        type: 'result',
        subtype: 'error_max_turns',
      }),
    ]);
  });
});
