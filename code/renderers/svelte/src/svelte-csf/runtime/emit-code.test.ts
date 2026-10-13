import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';

import { emitCode } from './emit-code.ts';

const emit = vi.hoisted(() => vi.fn());

vi.mock('storybook/internal/preview-api', () => ({
  addons: { getChannel: () => ({ emit }) },
}));

const emitted = (__svelteCsf: object, args: Record<string, any>, docs = {}) => {
  const storyContext = {
    id: 'button--primary',
    unmappedArgs: args,
    parameters: { __isArgsStory: true, __svelteCsf, docs },
  } as any;
  emitCode({ args, storyContext });
  vi.runAllTimers();
  return emit.mock.calls.at(-1)?.[1]?.source;
};

describe('emitCode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    emit.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits the template filled with the current args', () => {
    const rawCode = '<Button {...args}>{args.children}</Button>';
    const template = '<Button⟦props -children⟧>⟦text children⟧</Button>';
    expect(emitted({ rawCode, template }, { primary: true, children: 'Save' })).toBe(
      '<Button primary>Save</Button>'
    );
    expect(emit).toHaveBeenCalledWith(
      SNIPPET_RENDERED,
      expect.objectContaining({ id: 'button--primary' })
    );
  });

  it('emits the raw code without a template, or with an arg the template cannot show', () => {
    expect(emitted({ rawCode: '<Button {...props} />' }, { a: 1 })).toBe('<Button {...props} />');
    expect(emitted({ rawCode: '{args.map}', template: '⟦text map⟧' }, { map: new Map() })).toBe(
      '{args.map}'
    );
  });

  it('emits nothing for a story that sets its own code', () => {
    emitted({ rawCode: '<Button />' }, {}, { source: { code: '<Custom />' } });
    expect(emit).not.toHaveBeenCalled();
  });
});
