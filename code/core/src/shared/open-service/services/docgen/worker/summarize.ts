import { getComponentIdFromEntry } from '../../../../../common/utils/component-id.ts';
import type { IndexEntry } from '../../../../../types/modules/indexer.ts';
import type { ComponentSummary, DocgenSummaryProvider } from '../types.ts';

/**
 * The summarizer of a provider chain, from the summary provider of each module, innermost first as
 * the chain is composed. `undefined` when a module has none, so that its docgen has to be
 * extracted.
 */
export function createSummarizer(providers: (DocgenSummaryProvider | undefined)[]) {
  // Outermost first, the order a docgen request reaches the middlewares in.
  const outermostFirst = providers.filter((provider) => provider !== undefined).reverse();
  if (outermostFirst.length < providers.length) {
    return undefined;
  }

  return async (entries: IndexEntry[]): Promise<ComponentSummary[]> => {
    const summaries: (ComponentSummary | undefined)[] = entries.map(() => undefined);
    let unanswered = entries.map((_, position) => position);
    for (const provider of outermostFirst) {
      const answers = await provider(unanswered.map((position) => ({ entry: entries[position] })));
      unanswered = unanswered.filter((position, index) => {
        const answer = answers[index];
        if (answer) {
          summaries[position] = { id: getComponentIdFromEntry(entries[position]), ...answer };
        }
        return !answer;
      });
    }

    // No provider knows the component, so it has no docgen either, and is listed by its id.
    return entries.map((entry, position) => {
      const id = getComponentIdFromEntry(entry);
      return summaries[position] ?? { id, name: id };
    });
  };
}
