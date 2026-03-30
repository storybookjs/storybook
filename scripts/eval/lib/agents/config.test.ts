import { describe, expect, it } from 'vitest';

import { AGENTS } from './config';

describe('AGENTS', () => {
  it('keeps each agent default inside its supported model and effort lists', () => {
    for (const config of Object.values(AGENTS)) {
      expect(config).toMatchObject({
        defaultModel: expect.any(String),
        defaultEffort: expect.any(String),
      });
      expect(config.models).toContain(config.defaultModel);
      expect(config.efforts).toContain(config.defaultEffort);
    }
  });

  it('keeps Claude models fully remappable to SDK model ids', () => {
    expect(AGENTS.claude).toMatchObject({
      defaultModel: 'sonnet-4.6',
      defaultEffort: 'high',
      sdkModelIds: Object.fromEntries(
        AGENTS.claude.models.map((model) => [model, expect.any(String)])
      ),
    });
  });

  it('keeps Codex models fully priceable from token usage', () => {
    expect(AGENTS.codex).toMatchObject({
      defaultModel: 'gpt-5.4',
      defaultEffort: 'high',
      pricing: {
        'gpt-5.4': {
          input: 2.5,
          cachedInput: 0.25,
          output: 15,
        },
      },
    });
  });
});
