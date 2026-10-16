import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  cancel: vi.fn(),
  isCancel: (value: unknown) => value === Symbol.for('cancelled'),
  spinner: vi.fn(),
  taskLog: vi.fn(),
}));

vi.mock('../logger/log-tracker.ts', () => ({
  logTracker: {
    addLog: vi.fn(),
  },
}));

import * as clack from '@clack/prompts';

import type { PromptOptions } from './prompt-provider-base.ts';
import { ClackPromptProvider, PromptAbortedError } from './prompt-provider-clack.ts';

const CANCELLED = Symbol.for('cancelled');

type PromptCallOptions = { signal?: AbortSignal };

// Stand-in for real clack prompts: resolve with the answer, or — when the provider passes a
// signal and it aborts — settle on the cancel symbol exactly like real clack does.
const settleLikeClack = (answer: unknown) => (options?: PromptCallOptions) => {
  const signal = options?.signal;
  if (!signal) {
    return Promise.resolve(answer);
  }
  if (signal.aborted) {
    return Promise.resolve(CANCELLED);
  }
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => resolve(CANCELLED), { once: true });
    Promise.resolve(answer).then(resolve, reject);
  });
};

// A prompt that never settles on its own — the piped-CI condition — until its signal aborts.
const neverSettling = (options?: PromptCallOptions) => {
  const signal = options?.signal;
  if (signal?.aborted) {
    return Promise.resolve(CANCELLED);
  }
  return new Promise((resolve) => {
    signal?.addEventListener('abort', () => resolve(CANCELLED), { once: true });
  });
};

const mockAllPrompts = (implementation: (options?: PromptCallOptions) => Promise<unknown>) => {
  vi.mocked(clack.text).mockImplementation(implementation as never);
  vi.mocked(clack.confirm).mockImplementation(implementation as never);
  vi.mocked(clack.select).mockImplementation(implementation as never);
  vi.mocked(clack.multiselect).mockImplementation(implementation as never);
};

describe('ClackPromptProvider', () => {
  const provider = new ClackPromptProvider();
  const task = { message: vi.fn(), success: vi.fn(), error: vi.fn() };
  const promptMethods = ['text', 'confirm', 'select', 'multiselect'] as const;

  const runPrompt = (method: (typeof promptMethods)[number], promptOptions?: PromptOptions) => {
    switch (method) {
      case 'text':
        return provider.text({ message: 'Name' }, promptOptions);
      case 'confirm':
        return provider.confirm({ message: 'Continue' }, promptOptions);
      case 'select':
        return provider.select(
          { message: 'Pick one', options: [{ label: 'A', value: 'a' }] },
          promptOptions
        );
      case 'multiselect':
        return provider.multiselect(
          { message: 'Pick many', options: [{ label: 'A', value: 'a' }] },
          promptOptions
        );
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clack.taskLog).mockReturnValue(task as never);
    // Shared default: every prompt answers unless a test overrides it for its own scenario.
    mockAllPrompts(settleLikeClack('a'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Vitest workers do not write to a terminal, so the provider assumes 80 columns.
  it('drops the colors of a task log line only when they push it onto an extra terminal row', () => {
    const cyan = (text: string) => `\x1b[36m${text}\x1b[39m`;
    const nearlyFull = `${'x'.repeat(51)} ${cyan('.storybook/preview')}`;
    const short = cyan('✔ addon-mcp');

    const log = provider.taskLog({ id: 'task', title: 'Task' });
    expect(clack.taskLog).toHaveBeenCalledWith({
      limit: 10,
      retainLog: true,
      id: 'task',
      title: 'Task',
    });
    log.message(`${short}\n${nearlyFull}`);
    log.success('done');

    expect(task.message).toHaveBeenCalledWith(`${short}\n${'x'.repeat(51)} .storybook/preview`);
  });

  it('awaits an async onCancel handler before rejecting the aborted prompt', async () => {
    const stepOrder: string[] = [];
    const release = Promise.withResolvers<void>();
    vi.mocked(clack.select).mockImplementation(settleLikeClack(CANCELLED));

    const promptPromise = provider.select(
      {
        message: 'Pick one',
        options: [{ label: 'A', value: 'a' }],
      },
      {
        onCancel: async () => {
          stepOrder.push('onCancel-start');
          await release.promise;
          stepOrder.push('onCancel-end');
        },
      }
    );

    // Wait for onCancel to actually start rather than counting microtask ticks; the intent is
    // only that onCancel is entered and blocked on `release` before the prompt is rejected.
    await vi.waitFor(() => expect(stepOrder).toEqual(['onCancel-start']));

    release.resolve();
    await expect(promptPromise).rejects.toBeInstanceOf(PromptAbortedError);

    expect(stepOrder).toEqual(['onCancel-start', 'onCancel-end']);
  });

  it.each(promptMethods)(
    '%s exits 1 through the default cancel handler when the prompt is cancelled',
    async (method) => {
      // A user Ctrl+C settles the prompt on clack's cancel symbol. The flow is incomplete at
      // that point, so the process must exit 1 — an exit code of 0 tells CI the add/init flow
      // succeeded.
      mockAllPrompts(settleLikeClack(CANCELLED));
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await runPrompt(method);

      expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith('Operation canceled.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    }
  );

  it.each(promptMethods)('%s exits 1 when stdin ends before the prompt settles', async (method) => {
    // Piped CI runs close stdin before any answer arrives; clack leaves the prompt pending and
    // the process would drain to exit 0 with the init incomplete. The provider aborts the
    // prompt through clack's signal, which settles it as cancelled.
    mockAllPrompts(neverSettling);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const promptPromise = runPrompt(method);
    process.stdin.emit('end');
    await promptPromise;

    expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith(
      'Prompt aborted: stdin ended before an answer was received.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it.each(promptMethods)(
    '%s aborts immediately when stdin has already ended before the prompt runs',
    async (method) => {
      mockAllPrompts(neverSettling);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const readableEndedSpy = vi
        .spyOn(process.stdin, 'readableEnded', 'get')
        .mockReturnValue(true);

      await runPrompt(method);

      expect(vi.mocked(clack.cancel)).toHaveBeenCalledWith(
        'Prompt aborted: stdin ended before an answer was received.'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      readableEndedSpy.mockRestore();
    }
  );

  it.each(promptMethods)(
    '%s reports stdin-ended to onCancel on EOF and rejects when the handler returns',
    async (method) => {
      mockAllPrompts(neverSettling);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const onCancel = vi.fn();

      const promptPromise = runPrompt(method, { onCancel });
      process.stdin.emit('end');
      await expect(promptPromise).rejects.toBeInstanceOf(PromptAbortedError);

      expect(onCancel).toHaveBeenCalledWith('stdin-ended');
      expect(exitSpy).not.toHaveBeenCalled();
    }
  );

  it('reports cancel — not stdin-ended — to onCancel on a user cancellation', async () => {
    vi.mocked(clack.select).mockImplementation(settleLikeClack(CANCELLED));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onCancel = vi.fn();

    await expect(
      provider.select({ message: 'Pick one', options: [{ label: 'A', value: 'a' }] }, { onCancel })
    ).rejects.toBeInstanceOf(PromptAbortedError);

    expect(onCancel).toHaveBeenCalledWith('cancel');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('ignores stdin ending after the prompt has settled', async () => {
    // `echo a | storybook add` closes stdin right after the answer is read; that must not abort.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const result = await provider.select({
      message: 'Pick one',
      options: [{ label: 'A', value: 'a' }],
    });
    process.stdin.emit('end');

    expect(result).toBe('a');
    expect(vi.mocked(clack.cancel)).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
