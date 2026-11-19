import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SNIPPET_RENDERED } from '../../../docs-tools/index.ts';
import { addons } from '../addons/index.ts';
import { emitTransformCode } from './emitTransformCode.ts';

vi.mock('../addons/index.ts', { spy: true });

type Context = Parameters<typeof emitTransformCode>[1];

const emit = vi.fn();

beforeEach(() => {
  emit.mockReset();
  vi.mocked(addons.getChannel).mockReturnValue({ emit } as never);
});

const emitted = async (context: Context, previewOnly?: boolean) => {
  await emitTransformCode('<Button />', context, undefined, previewOnly);
  return emit.mock.calls[0];
};

describe('emitTransformCode', () => {
  it('marks a snippet the story transforms, which only the preview can transform', async () => {
    const context = {
      id: 'button--primary',
      unmappedArgs: {},
      parameters: { docs: { source: { transform: (code: string) => `// Hi\n${code}` } } },
    } as unknown as Context;

    expect(await emitted(context)).toEqual([
      SNIPPET_RENDERED,
      expect.objectContaining({ source: '// Hi\n<Button />', previewOnly: true }),
    ]);
  });

  it('marks a snippet whose args only the preview holds', async () => {
    const context = { id: 'button--primary', unmappedArgs: {}, parameters: {} } as Context;

    expect(await emitted(context, true)).toEqual([
      SNIPPET_RENDERED,
      expect.objectContaining({ source: '<Button />', previewOnly: true }),
    ]);
  });

  it('does not mark a snippet the manager can fill as well', async () => {
    const context = { id: 'button--primary', unmappedArgs: {}, parameters: {} } as Context;

    expect(await emitted(context)).toEqual([
      SNIPPET_RENDERED,
      expect.objectContaining({ source: '<Button />', previewOnly: false }),
    ]);
  });
});
