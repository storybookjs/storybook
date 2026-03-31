import { describe, expect, it } from 'vitest';

import { AGENTS, getDefaultVariant } from './config';

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
      defaultEffort: 'medium',
      execution: {
        maxTurns: 50,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionModel: 'tool-allowlist',
      },
      sdkModelIds: Object.fromEntries(
        AGENTS.claude.models.map((model) => [model, expect.any(String)])
      ),
    });
  });

  it('keeps Codex models fully priceable from token usage', () => {
    expect(AGENTS.codex).toMatchObject({
      defaultModel: 'gpt-5.4',
      defaultEffort: 'medium',
      execution: {
        approvalPolicy: 'never',
        permissionModel: 'approval-policy-never',
      },
      pricing: {
        'gpt-5.4': {
          input: 2.5,
          cachedInput: 0.25,
          output: 15,
        },
      },
    });
  });

  it('derives default variants from the central agent definitions', () => {
    expect(getDefaultVariant('claude')).toEqual({
      agent: 'claude',
      model: 'sonnet-4.6',
      effort: 'medium',
    });
    expect(getDefaultVariant('codex')).toEqual({
      agent: 'codex',
      model: 'gpt-5.4',
      effort: 'medium',
    });
  });
});
