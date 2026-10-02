import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { selectMock, textMock, confirmMock, multiselectMock, cancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  textMock: vi.fn(),
  confirmMock: vi.fn(),
  multiselectMock: vi.fn(),
  cancelMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  multiselect: multiselectMock,
  cancel: cancelMock,
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

import { ClackPromptProvider } from './prompt-provider-clack.ts';

describe('ClackPromptProvider', () => {
  const provider = new ClackPromptProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Vitest workers do not write to a terminal, so the provider assumes 80 columns.
  it('drops the colors of a task log line only when they push it onto an extra terminal row', () => {
    const task = { message: vi.fn(), success: vi.fn(), error: vi.fn() };
    vi.mocked(clack.taskLog).mockReturnValue(task as never);
    const cyan = (text: string) => `\x1b[36m${text}\x1b[39m`;
    const nearlyFull = `${'x'.repeat(51)} ${cyan('.storybook/preview')}`;
    const short = cyan('✔ addon-mcp');

    const log = provider.taskLog({ id: 'task', title: 'Task' });
    log.message(`${short}\n${nearlyFull}`);
    log.success('done');

    expect(task.message).toHaveBeenCalledWith(`${short}\n${'x'.repeat(51)} .storybook/preview`);
  });

  it('awaits an async onCancel handler before returning', async () => {
    const stepOrder: string[] = [];
    const release = Promise.withResolvers<void>();
    selectMock.mockResolvedValue(Symbol.for('cancelled'));

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

    await Promise.resolve();
    expect(stepOrder).toEqual(['onCancel-start']);

    release.resolve();
    await promptPromise;

    expect(stepOrder).toEqual(['onCancel-start', 'onCancel-end']);
  });

  it('falls back to the default cancel behavior when no onCancel is provided', async () => {
    selectMock.mockResolvedValue(Symbol.for('cancelled'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await provider.select({
      message: 'Pick one',
      options: [{ label: 'A', value: 'a' }],
    });

    expect(cancelMock).toHaveBeenCalledWith('Operation canceled.');
    expect(exitSpy).toHaveBeenCalledWith(0);

    exitSpy.mockRestore();
  });
});
