import { describe, expect, it, vi } from 'vitest';

import { Tag } from '../../shared/constants/tags.ts';
import { loadCsf } from '../CsfFile.ts';
import { vitestTransform } from './transformer.ts';

vi.mock('../../common/utils/get-story-id.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../common/utils/get-story-id.ts')>()),
  getStoryTitle: vi.fn(() => 'Button'),
}));

const fileName = 'src/Button.stories.ts';

/**
 * The test names the Vitest transform gives a stories file, next to the index entries of that
 * file. A focused run selects index entries and matches them to tests by name or export name
 * (`VitestManager.buildStoryTestNamePattern`), so every entry must find its test by one of the two.
 */
async function namesOf(code: string) {
  const transformed = await vitestTransform({
    code,
    fileName,
    configDir: '.storybook',
    stories: [],
    tagsFilter: { include: [Tag.TEST], exclude: [], skip: [] },
    previewLevelTags: [],
  });
  const output = typeof transformed === 'string' ? transformed : transformed.code;
  const tail = output.slice(output.indexOf('if (_isRunningFromThisFile)'));
  const tests = [...tail.matchAll(/_test\(("(?:[^"\\]|\\.)*")/g)].map(([, name]) =>
    JSON.parse(name)
  );
  const describes = [...tail.matchAll(/_describe\(("(?:[^"\\]|\\.)*")/g)].map(([, name]) =>
    JSON.parse(name)
  );
  const entries = loadCsf(code, { fileName, makeTitle: (title) => title ?? 'Button' }).parse()
    .indexInputs;
  return { tests, describes, entries };
}

async function expectEveryEntryToFindItsTest(code: string) {
  const { tests, describes, entries } = await namesOf(code);
  for (const entry of entries) {
    if (entry.type !== 'story') {
      continue;
    }
    const candidates = [entry.name, entry.exportName];
    if (entry.subtype === 'test') {
      expect(tests).toContain(entry.name);
      expect(
        describes.some((name: string) =>
          candidates
            .concat((entry as { parentName?: string }).parentName)
            .some((candidate) => `${candidate}  ` === name)
        )
      ).toBe(true);
    } else {
      const own = [...tests, ...describes.map((name: string) => name.trimEnd())];
      expect(candidates.some((candidate) => own.includes(candidate))).toBe(true);
    }
  }
  return { tests, describes, entries };
}

describe('test names of the Vitest transform, against the story index', () => {
  it('a CSF3 story without a name is tested under the name derived from its export', async () => {
    const { tests, entries } = await expectEveryEntryToFindItsTest(`
      export default {};
      export const PrimaryButton = {};
    `);
    expect(entries[0].name).toBe('Primary Button');
    expect(tests).toEqual(['Primary Button']);
  });

  it('a CSF3 story with a name, punctuation and non-ASCII characters', async () => {
    const { tests } = await expectEveryEntryToFindItsTest(`
      export default {};
      export const Grüße = { name: 'Héllo, wörld! (1/2) [a] $b*' };
      export const Other = {};
      Other.storyName = 'Renamed + more?';
    `);
    expect(tests).toEqual(['Héllo, wörld! (1/2) [a] $b*', 'Renamed + more?']);
  });

  it('a story exported as `export { X as Y }` is tested under its export name', async () => {
    const { tests, entries } = await expectEveryEntryToFindItsTest(`
      export default {};
      const $__HoverShowsFullDate = { name: 'Hover Shows Full Date' };
      export { $__HoverShowsFullDate as HoverShowsFullDate };
    `);
    expect(tests).toEqual(['HoverShowsFullDate']);
    expect(entries[0].exportName).toBe('HoverShowsFullDate');
  });

  it('CSF factories, with a name and with `.test()` entries', async () => {
    await expectEveryEntryToFindItsTest(`
      import { config } from '#.storybook/preview';
      const meta = config.meta({});
      export const Primary = meta.story({ name: 'The primary one' });
      Primary.test('renders the label', async () => {});
      export const Secondary = meta.story({});
      Secondary.test('works, really?', async () => {});
    `);
  });
});
