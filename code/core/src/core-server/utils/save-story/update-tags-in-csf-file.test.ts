import { describe, expect, test } from 'vitest';

import { loadCsf, printCsf } from 'storybook/internal/csf-tools';

import { format } from 'prettier';

import { removeStoryTagsInCsfFile, updateStoryTagsInCsfFile } from './update-tags-in-csf-file.ts';

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

describe('removeStoryTagsInCsfFile', () => {
  test('removes a single tag while preserving other tags', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['profile', 'qwertzu'],
        args: {
          primary: true,
        },
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();
    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await removeStoryTagsInCsfFile(node!, ['qwertzu']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
    expect(result).not.toContain(`"qwertzu"`);
  });

  test('removes the tags property when the last tag is removed', async () => {
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

    await removeStoryTagsInCsfFile(node!, ['profile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).not.toContain('tags:');
    expect(result).not.toContain(`"profile"`);
  });

  test('removes only the requested tag', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['profile', 'mobile', 'qwertzu'],
        args: {},
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();
    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await removeStoryTagsInCsfFile(node!, ['mobile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile", "qwertzu"]`);
    expect(result).not.toContain(`"mobile"`);
  });

  test('does not change tags when removing an unknown tag', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['profile'],
        args: {},
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();
    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await removeStoryTagsInCsfFile(node!, ['does-not-exist']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
  });

  test('removes multiple tags at once', async () => {
    const code = `
      export default {
        title: 'Example/Button',
      };

      export const Primary = {
        tags: ['profile', 'mobile', 'qwertzu'],
        args: {},
      };
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();
    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await removeStoryTagsInCsfFile(node!, ['mobile', 'qwertzu']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
    expect(result).not.toContain(`"mobile"`);
    expect(result).not.toContain(`"qwertzu"`);
  });

  test('removes tags from a CSF4 story', async () => {
    const code = `
      import preview from '#.storybook/preview';

      const meta = preview.meta({
        title: 'Example/Button',
      });

      export const Primary = meta.story({
        tags: ['profile', 'mobile'],
        args: {
          primary: true,
        },
      });
    `;

    const csf = loadCsf(code, { makeTitle });
    const parsed = csf.parse();
    const node = csf.getStoryExport('Primary');

    expect(node).toBeDefined();

    await removeStoryTagsInCsfFile(node!, ['mobile']);

    const result = await formatCode(printCsf(parsed).code);

    expect(result).toContain(`tags: ["profile"]`);
    expect(result).not.toContain(`"mobile"`);
  });
});
