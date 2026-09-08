import { describe, expect, test } from 'vitest';

import { loadCsf, printCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { updateStoryTagsInCsfFile } from './update-tags-in-csf-file.ts';

const makeTitle = (userTitle: string) => userTitle;

const formatCode = async (code: string) =>
  format(code, {
    parser: 'typescript',
  });

describe('updateStoryTagsInCsfFile', () => {
  test('adds tags to a CSF3 story without tags', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        args: {
          primary: true,
        },
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();

    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await updateStoryTagsInCsfFile(node!, ['profile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
  });

  test('adds tags to a CSF4 story without tags', async () => {
    const code = `
      import preview from '#.storybook/preview';

      const meta = preview.meta({
        title: 'Example/Button',
      });

      export const Primary = meta.story({
        args: {
          primary: true,
        },
      });
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();

    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await updateStoryTagsInCsfFile(node!, ['profile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
  });

  test('preserves existing tags', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['existing'],
        args: {
          primary: true,
        },
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();

    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await updateStoryTagsInCsfFile(node!, ['profile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["existing", "profile"]`);
  });

  test('does not add duplicate tags', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['profile'],
        args: {
          primary: true,
        },
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();

    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await updateStoryTagsInCsfFile(node!, ['profile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result.match(/"profile"/g)).toHaveLength(1);
  });

  test('adds multiple tags', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        args: {},
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();

    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await updateStoryTagsInCsfFile(node!, ['profile', 'homepage']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile", "homepage"]`);
  });
});
