import { describe, expect, it } from 'vitest';

import { agenticRefExperiment, providerOf } from './experiment.ts';

import type { RunCompleteContext } from '@vercel/agent-eval';

describe('providerOf', () => {
  it('reads a gateway-routed agent as the AI gateway', () => {
    expect(providerOf('vercel-ai-gateway/claude-code')).toBe('ai-gateway');
  });

  it('reads a bare claude-code agent as anthropic, i.e. direct', () => {
    expect(providerOf('claude-code')).toBe('anthropic');
  });

  // Codex runs direct against OpenAI; recording it as anthropic would be wrong.
  it('reads a codex agent as openai, i.e. direct', () => {
    expect(providerOf('codex')).toBe('openai');
  });
});

describe('run output provider', () => {
  // The provider cannot be read back out of a transcript, so the hook must
  // record it at collection time from the eval config that ran.
  it('records the eval config LLM provider in the run result', () => {
    const experiment = agenticRefExperiment({ name: 'provider-probe', evals: [] });
    const context = {
      runData: { result: {} },
      fixture: { path: '/nowhere' },
    } as unknown as RunCompleteContext;

    const runData = experiment.onRunComplete?.(context) as {
      result: { analysis: { provider?: string } };
    };

    expect(runData.result.analysis.provider).toBe('anthropic');
  });
});
