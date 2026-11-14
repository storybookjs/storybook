import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isCI } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { detectAgent } from 'storybook/internal/telemetry';

import { answersPromptsWithYes, promptlessReason } from './prompts.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

const setTTY = (stdin: boolean | undefined, stdout: boolean | undefined) => {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: stdin,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: stdout,
    configurable: true,
    writable: true,
  });
};

const descriptors = {
  stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
  stdout: Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'),
};

const restore = (
  stream: NodeJS.ReadStream | NodeJS.WriteStream,
  descriptor?: PropertyDescriptor
) => {
  if (descriptor) {
    Object.defineProperty(stream, 'isTTY', descriptor);
  } else {
    delete (stream as { isTTY?: boolean }).isTTY;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isCI).mockReturnValue(false);
  vi.mocked(detectAgent).mockReturnValue(undefined);
  vi.mocked(logger.log).mockImplementation(() => {});
  setTTY(true, true);
});

afterEach(() => {
  restore(process.stdin, descriptors.stdin);
  restore(process.stdout, descriptors.stdout);
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

    expect(promptlessReason()).toBe(
      'a coding agent (codex) runs it (pass --no-agent to answer them yourself)'
    );
  });

  it('lets a person in a terminal answer with --no-agent, whatever std-env detects', () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'replit' });

    expect(promptlessReason({ detectAgents: false })).toBeUndefined();
  });
});

describe('answersPromptsWithYes', () => {
  it('keeps --yes without a message', () => {
    setTTY(false, false);

    expect(answersPromptsWithYes({ yes: true })).toBe(true);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('keeps the prompts for a person at a terminal', () => {
    expect(answersPromptsWithYes({ yes: false })).toBe(false);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('answers as --yes without a terminal, and says why', () => {
    setTTY(false, true);

    expect(answersPromptsWithYes({})).toBe(true);
    expect(logger.log).toHaveBeenCalledWith(
      'Running without prompts, as with --yes, because there is no interactive terminal.'
    );
  });

  it('keeps the prompts for a person whose shell looks like an agent, with --no-agent', () => {
    vi.mocked(detectAgent).mockReturnValue({ name: 'replit' });

    expect(answersPromptsWithYes({ agent: false })).toBe(false);
  });
});
