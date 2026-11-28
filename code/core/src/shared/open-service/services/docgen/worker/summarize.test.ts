import { describe, expect, it, vi } from 'vitest';

import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import type { DocgenSummaryProvider } from '../types.ts';
import { createSummarizer } from './summarize.ts';

const entry = (id: string, title = id): IndexEntry => ({
  type: 'story',
  subtype: 'story',
  id: `${id}--default`,
  name: 'Default',
  title,
  importPath: `./${id}.stories.ts`,
});

describe('createSummarizer', () => {
  it('asks the outermost provider first and hands what it leaves out to the next', async () => {
    const outer = vi.fn<DocgenSummaryProvider>((inputs) =>
      inputs.map(({ entry: { title } }) => (title === 'button' ? { name: 'Button' } : undefined))
    );
    const inner = vi.fn<DocgenSummaryProvider>((inputs) => inputs.map(() => ({ name: 'Inner' })));

    const summaries = await createSummarizer([inner, outer])!([entry('button'), entry('card')]);

    expect(summaries).toEqual([
      { id: 'button', name: 'Button' },
      { id: 'card', name: 'Inner' },
    ]);
    expect(inner).toHaveBeenCalledWith([{ entry: entry('card') }]);
  });

  it('lists a component no provider knows by its id, as one without docgen', async () => {
    const summarize = createSummarizer([(inputs) => inputs.map(() => undefined)])!;

    expect(await summarize([entry('button')])).toEqual([{ id: 'button', name: 'button' }]);
  });

  it('summarizes nothing when a module of the chain has no summary provider', () => {
    expect(createSummarizer([(inputs) => inputs.map(() => ({ name: 'Button' })), undefined])).toBe(
      undefined
    );
  });
});
