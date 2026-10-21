// Shared by `corpus.test.ts`, which passes the sources, and `record.mjs`, which passes a compiled
// checkout, so the recorded and the tested transforms are summarized the same way. Node runs it
// through type stripping: it may only import types.
import type { format } from 'prettier';

import type * as CsfTools from '../index.ts';

export interface CorpusTools {
  csfTools: typeof CsfTools;
  format: typeof format;
}

const makeTitle = (title?: string) => title ?? 'Untitled';

const run = async (transform: () => Promise<string>) => {
  try {
    return await transform();
  } catch {
    return undefined;
  }
};

// Each story's `parameters.docs.source.originalSource` in the enriched code.
const originalSources = ({ parseModule, walk }: typeof CsfTools, file: string, code: string) => {
  const sources: Record<string, string> = {};
  for (const statement of parseModule(code, file).program.body) {
    if (
      statement.type !== 'ExpressionStatement' ||
      statement.expression.type !== 'AssignmentExpression'
    ) {
      continue;
    }
    let story: CsfTools.ESTreeNode = statement.expression.left;
    while (story.type === 'MemberExpression') {
      story = story.object;
    }
    const name = story.type === 'Identifier' ? story.name : undefined;
    walk(statement.expression.right, (node) => {
      if (
        name &&
        node.type === 'Property' &&
        node.key.type === 'Identifier' &&
        node.key.name === 'originalSource' &&
        node.value.type === 'Literal' &&
        typeof node.value.value === 'string'
      ) {
        sources[name] = node.value.value;
      }
    });
  }
  return sources;
};

// The `enrichCsf` and `vitestTransform` outputs for a corpus input, formatted with Prettier so the
// comparison ignores layout, which Babel reprinted and OXC keeps as written.
export const summarizeTransforms = async (
  { csfTools, format }: CorpusTools,
  inputs: string,
  file: string,
  code: string
) => {
  const { enrichCsf, formatCsf, loadCsf, vitestTransform } = csfTools;
  const enriched = await run(async () => {
    const csf = loadCsf(code, { fileName: file, makeTitle }).parse();
    await enrichCsf(csf, loadCsf(code, { fileName: file, makeTitle }).parse());
    return formatCsf(csf) as string;
  });
  const vitest = await run(
    async () =>
      (
        await vitestTransform({
          code,
          fileName: `${inputs}/${file}`,
          configDir: inputs,
          stories: ['./*.stories.*'],
          tagsFilter: { include: ['test'], exclude: [], skip: [] },
          previewLevelTags: [],
        })
      ).code
  );
  // Prettier keeps blank lines and objects written across lines, so those are dropped and collapsed.
  const pretty = (output: string | undefined) =>
    output === undefined
      ? { error: true }
      : format(output.replace(/^[ \t]*\r?\n/gm, ''), { filepath: file, objectWrap: 'collapse' });
  return {
    enriched: await pretty(enriched),
    originalSources: enriched === undefined ? {} : originalSources(csfTools, file, enriched),
    vitest: await pretty(vitest),
  };
};
