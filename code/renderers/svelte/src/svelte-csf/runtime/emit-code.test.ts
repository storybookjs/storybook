import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons } from 'storybook/internal/preview-api';

import { emitCode } from './emit-code.ts';

vi.mock('storybook/internal/preview-api', { spy: true });

const emit = vi.fn();

const emitted = (__svelteCsf: object, args: Record<string, any>, docs = {}, initialArgs = args) => {
  const storyContext = {
    id: 'button--primary',
    unmappedArgs: args,
    initialArgs,
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
    vi.mocked(addons.getChannel).mockReturnValue({ emit } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits the template filled with the current args', () => {
    const rawCode = '<Button {...args}>{args.children}</Button>';
    const template = '<Button ⟦props -children⟧>⟦text children⟧</Button>';
    expect(emitted({ rawCode, template }, { primary: true, children: 'Save' })).toBe(
      '<Button primary>Save</Button>'
    );
    expect(emit).toHaveBeenCalledWith(
      SNIPPET_RENDERED,
      expect.objectContaining({ id: 'button--primary' })
    );
  });

  it('emits an arg that still holds the value the story writes as the code it writes', () => {
    const onclick = Object.assign(() => {}, { getMockName: () => 'spy' });
    const svelteCsf = {
      rawCode: '<Button {...args} />',
      template: '<Button ⟦props⟧ />',
      argCode: { onclick: 'fn()' },
    };
    const initialArgs = { label: 'Go', onclick };
    expect(emitted(svelteCsf, initialArgs)).toBe('<Button label="Go" onclick={fn()} />');
    expect(emitted(svelteCsf, { label: 'Stop', onclick }, {}, initialArgs)).toBe(
      '<Button label="Stop" onclick={fn()} />'
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
