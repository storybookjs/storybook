import { describe, expect, it } from 'vitest';

import { isClaudePreviewLaunch } from './agent-environment.ts';

describe('isClaudePreviewLaunch', () => {
  it('detects Claude preview launcher environments', () => {
    expect(isClaudePreviewLaunch({ CLAUDE_AGENT_SDK_VERSION: '0.1.0' })).toBe(true);
  });

  it('does not detect Claude preview when an explicit agent is present', () => {
    expect(isClaudePreviewLaunch({ AI_AGENT: 'claude', CLAUDE_AGENT_SDK_VERSION: '0.1.0' })).toBe(
      false
    );
  });

  it('does not detect Claude preview without the Claude launcher signal', () => {
    expect(isClaudePreviewLaunch({})).toBe(false);
  });
});
