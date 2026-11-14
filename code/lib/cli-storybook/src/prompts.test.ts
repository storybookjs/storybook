import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

import { answersPromptsWithYes, promptlessReason } from './prompts.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const setTTY = (stdin: boolean | undefined, stdout: boolean | undefined) => {
  Object.defineProperty(process.stdin, 'isTTY', { value: stdin, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: stdout, configurable: true });
};

const original = { stdin: process.stdin.isTTY, stdout: process.stdout.isTTY };

beforeEach(() => {
  vi.mocked(isCI).mockReturnValue(false);
  vi.mocked(detectAgent).mockReturnValue(undefined);
  vi.mocked(logger.log).mockImplementation(() => {});
  setTTY(true, true);
});

afterEach(() => {
  setTTY(original.stdin, original.stdout);
});

describe('promptlessReason', () => {
  it('lets a person at a terminal answer', () => {
    expect(promptlessReason()).toBeUndefined();
  });

  it.each([
    ['stdin', false, true],
    ['stdout', true, false],
    ['both', undefined, undefined],
  ])('has no terminal when %s is not a TTY', (_, stdin, stdout) => {
    setTTY(stdin, stdout);

    expect(promptlessReason()).toBe('there is no interactive terminal');
  });

  it('does not prompt in CI', () => {
    vi.mocked(isCI).mockReturnValue(true);

    expect(promptlessReason()).toBe('CI is set');
  });

  it('does not prompt a coding agent, even in a terminal', () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'codex' });

    expect(promptlessReason()).toBe('a coding agent (codex) runs it');
  });
});

describe('answersPromptsWithYes', () => {
  it('keeps --yes without a message', () => {
    setTTY(false, false);

    expect(answersPromptsWithYes(true)).toBe(true);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('keeps the prompts for a person at a terminal', () => {
    expect(answersPromptsWithYes(false)).toBe(false);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('answers as --yes without a terminal, and says why', () => {
    setTTY(false, true);

    expect(answersPromptsWithYes(undefined)).toBe(true);
    expect(logger.log).toHaveBeenCalledWith(
      'Running without prompts, as with --yes, because there is no interactive terminal.'
    );
  });
});
