import { stripVTControlCharacters } from 'node:util';

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
import { ClackPromptProvider } from './prompt-provider-clack.ts';

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
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it('shortens a multiselect hint link to the width clack wraps option lines at', async () => {
    const stdout = Object.create(process.stdout);
    Object.defineProperty(stdout, 'columns', { configurable: true, value: 100 });
    Object.defineProperty(stdout, 'isTTY', { configurable: true, value: true });
    const stubbedProcess = Object.create(process);
    Object.defineProperty(stubbedProcess, 'stdout', { configurable: true, value: stdout });
    vi.stubGlobal('process', stubbedProcess);
    vi.stubEnv('TERM_PROGRAM', 'iTerm.app');
    vi.stubEnv('TERM_PROGRAM_VERSION', '3.4.0');
    const url =
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed';

    await provider.multiselect({
      message: 'Select automigrations to run',
      options: [{ value: 'fix', label: 'fix', hint: `Move it\nMore info: ${url}` }],
    });

    const { hint } = vi.mocked(clack.multiselect).mock.calls[0][0].options[0];
    const linkLine = stripVTControlCharacters(hint ?? '').split('\n')[1];
    expect(`${linkLine})`.length).toBeLessThanOrEqual(100 - 13);
    expect(hint).toContain(`\u001b]8;;${url}\u0007`);
  });

  // Clack wraps prompt messages with its own guide bar; a pre-wrapped message renders the bar twice.
  it('leaves wrapping prompt messages to clack', async () => {
    const message = `Do you want to run the 'component-subtitle' migration on your project? ${'word '.repeat(20)}`;

    await provider.confirm({ message });
    await provider.select({ message, options: [{ label: 'A', value: 'a' }] });

    expect(vi.mocked(clack.confirm)).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(vi.mocked(clack.select)).toHaveBeenCalledWith(
      expect.objectContaining({ message, showInstructions: false })
    );
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
    await expect(promptPromise).rejects.toMatchObject({ name: 'PromptAbortedError' });

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
      await expect(promptPromise).rejects.toMatchObject({
        name: 'PromptAbortedError',
        reason: 'stdin-ended',
      });

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
    ).rejects.toMatchObject({ name: 'PromptAbortedError', reason: 'cancel' });

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

  it('resolves a real answer even when stdin ends before the prompt settles', async () => {
    // `printf y | storybook add` can close stdin in the same tick the answer arrives. The prompt
    // result below was already computed when stdin ended (unlike an unsettled prompt, which the
    // abort signal legitimately cancels), so the abort decision — from the result alone — must
    // keep the answer.
    mockAllPrompts(() => Promise.resolve('a'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const onCancel = vi.fn();

    const promptPromise = runPrompt('select', { onCancel });
    process.stdin.emit('end');
    await expect(promptPromise).resolves.toBe('a');

    expect(onCancel).not.toHaveBeenCalled();
    expect(vi.mocked(clack.cancel)).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
