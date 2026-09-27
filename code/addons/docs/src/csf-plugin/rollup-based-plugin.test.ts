import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CsfFile } from 'storybook/internal/csf-tools';

import { vol } from 'memfs';

import { transformCsf } from './rollup-based-plugin.ts';

vi.mock('node:fs/promises', { spy: true });

const id = resolve('/project/Button.stories.tsx');
const context = { getCombinedSourcemap: () => null };

const source = `
/** Button component */
export default { title: 'Button' };

/** The primary button */
export const Primary = { args: { label: 'Primary' } };
`;

const transform = async (code: string, options = {}) => {
  const result = await transformCsf.call(context, code, id, options);
  return typeof result === 'string' ? result : result?.code;
};

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
  vol.reset();
  vol.fromJSON({ [id]: source });
});

describe('transformCsf', () => {
  it('enriches an untransformed story file with its source and descriptions', async () => {
    const code = await transform(source);

    expect(code).toContain('component: "Button component"');
    expect(code).toContain('story: "The primary button"');
    expect(code).toContain(`originalSource: "{\\n  args: {\\n    label: 'Primary'\\n  }\\n}"`);
  });

  it('takes the original source from the story file when the code was transformed', async () => {
    const transformed = source.replace(`label: 'Primary'`, `label: 'Transformed'`);

    const code = await transform(transformed);

    expect(code).toContain(`label: 'Transformed'`);
    expect(code).toContain(`originalSource: "{\\n  args: {\\n    label: 'Primary'\\n  }\\n}"`);
  });

  it('leaves the source passed to enrichCsf hooks unenriched', async () => {
    const enrichCsf = vi.fn(async (_csf: CsfFile, _csfSource: CsfFile) => {});

    await transform(source, { enrichCsf });

    const [, csfSource] = enrichCsf.mock.calls[0];
    expect(csfSource._ast.program.body).toHaveLength(2);
  });
});
