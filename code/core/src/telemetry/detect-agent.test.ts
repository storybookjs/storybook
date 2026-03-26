import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectAgent } from './detect-agent';

describe('detectAgent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects claude via CLAUDECODE', () => {
    vi.stubEnv('CLAUDECODE', '1');
    expect(detectAgent()).toEqual({ name: 'claude' });
  });

  it('detects claude via CLAUDE_CODE', () => {
    vi.stubEnv('CLAUDE_CODE', '1');
    expect(detectAgent()).toEqual({ name: 'claude' });
  });

  it('detects gemini via GEMINI_CLI', () => {
    vi.stubEnv('GEMINI_CLI', '1');
    expect(detectAgent()).toEqual({ name: 'gemini' });
  });

  it('detects codex via CODEX_SANDBOX', () => {
    vi.stubEnv('CODEX_SANDBOX', '1');
    expect(detectAgent()).toEqual({ name: 'codex' });
  });

  it('detects codex via CODEX_THREAD_ID', () => {
    vi.stubEnv('CODEX_THREAD_ID', '1');
    expect(detectAgent()).toEqual({ name: 'codex' });
  });

  it('detects cursor via CURSOR_AGENT', () => {
    vi.stubEnv('CURSOR_AGENT', '1');
    expect(detectAgent()).toEqual({ name: 'cursor' });
  });

  it('detects opencode via OPENCODE', () => {
    vi.stubEnv('OPENCODE', '1');
    expect(detectAgent()).toEqual({ name: 'opencode' });
  });

  it('detects explicit agent via AI_AGENT env var', () => {
    vi.stubEnv('AI_AGENT', 'copilot');
    expect(detectAgent()).toEqual({ name: 'copilot' });
  });

  it('normalizes AI_AGENT to lowercase', () => {
    vi.stubEnv('AI_AGENT', 'Copilot');
    expect(detectAgent()).toEqual({ name: 'copilot' });
  });

  it('AI_AGENT takes precedence over other env vars', () => {
    vi.stubEnv('AI_AGENT', 'copilot');
    vi.stubEnv('CLAUDECODE', '1');
    vi.stubEnv('GEMINI_CLI', '1');
    expect(detectAgent()).toEqual({ name: 'copilot' });
  });

  it('returns undefined when there are no signals', () => {
    expect(detectAgent()).toEqual(undefined);
  });
});
