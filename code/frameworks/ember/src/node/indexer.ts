import { readFile } from 'node:fs/promises';

import type { IndexInput, Indexer, IndexerOptions } from 'storybook/internal/types';

import { Preprocessor } from 'content-tag';

async function loadFile(fileName: string): Promise<string> {
  return (await readFile(fileName, { encoding: 'utf8' })).toString();
}

function parse(code: string) {
  const p = new Preprocessor();

  return p.parse(code);
}

// export function indexerCode(
//   code: string,
//   { makeTitle, fileName }: IndexerOptions & { fileName: string }
// ): IndexInput[] {
//   const result = parse(code);

//   console.log(result);
// }

export const emberIndexer: Indexer = {
  test: /\.stories\.g[tj]s$/,
  createIndex: async (fileName: string, options: IndexerOptions): Promise<IndexInput[]> => {
    const code = await loadFile(fileName);

    const result = parse(code);

    console.log('EMBER INDEXER', result);

    return [
      {
        name: 'Text',
        type: 'story',
        subtype: 'story',
        exportName: 'Text',
        importPath: fileName,
        title: 'Button',
      },
    ];
  },
};
