import { describe, expect, it } from 'vitest';

import {
  buildWriteStoriesSkill,
  type WriteStoriesSkillInputs,
} from './build-write-stories-skill.ts';

const reactTs: WriteStoriesSkillInputs = {
  framework: '@storybook/react-vite',
  csfFactories: false,
  previewFile: '.storybook/preview.ts',
  typescript: true,
};

describe('buildWriteStoriesSkill', () => {
  it('teaches CSF Factories instead of Meta and StoryObj when the preview uses definePreview', () => {
    const text = buildWriteStoriesSkill({
      ...reactTs,
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
    });

    expect(text).toContain('preview.meta({');
    expect(text).toContain('Do not import `Meta` or `StoryObj`');
    expect(text).not.toContain('Import `Meta` and `StoryObj`');
  });

  it('teaches Meta and StoryObj from the framework package otherwise', () => {
    const text = buildWriteStoriesSkill({ ...reactTs, framework: '@storybook/vue3-vite' });

    expect(text).toContain('Import `Meta` and `StoryObj` from `@storybook/vue3-vite`');
    expect(text).not.toContain('preview.meta({');
  });

  it('leaves out the Meta and StoryObj types in a JavaScript project', () => {
    const text = buildWriteStoriesSkill({
      ...reactTs,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });

    expect(text).not.toContain('StoryObj');
    expect(text).toContain('- Import `fn`, `expect`, `mocked` and `sb` from `storybook/test`.');
    expect(text).toContain("sb.mock(import('../src/api.js')");
  });

  it('puts MSW before module mocks and names the preview file of the project', () => {
    const text = buildWriteStoriesSkill({ ...reactTs, previewFile: 'config/preview.tsx' });

    expect(text.indexOf('msw.use(')).toBeLessThan(text.indexOf('sb.mock('));
    expect(text).toContain('register it in `config/preview.tsx`');
  });

  it('uses MSW only when the project has it set up, and never installs it', () => {
    const text = buildWriteStoriesSkill({ ...reactTs, previewFile: 'config/preview.tsx' });

    expect(text).toContain(
      'When the project has MSW set up for Storybook (`msw-storybook-addon` in its `package.json` and in `config/preview.tsx`)'
    );
    expect(text).toContain('never with a module mock or a replaced `fetch`');
    expect(text).toContain(
      'When the project has no MSW setup, do not add one or any other dependency'
    );
    expect(text).not.toMatch(/msw init|install `msw`|mswLoader|addonMsw/);
  });

  it('names no command and no other skill', () => {
    const text = buildWriteStoriesSkill(reactTs);

    expect(text).not.toContain('npx storybook');
    expect(text).not.toMatch(/component-docs|test-stories|ui-review/);
  });

  // The text the evals validated, so a wording change shows up here.
  it('full text', () => {
    expect(buildWriteStoriesSkill(reactTs)).toMatchInlineSnapshot(`
      "# Write the component and its stories

      Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

      - Import \`Meta\` and \`StoryObj\` from \`@storybook/react-vite\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
      - Leave \`title\` out of a new story file, so Storybook derives it from the file path.
      - \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options; to check a disabled element, assert \`toBeDisabled()\` instead of clicking it.
      - A story never calls a real service. When the project has MSW set up for Storybook (\`msw-storybook-addon\` in its \`package.json\` and in \`.storybook/preview.ts\`), mock network requests with it, never with a module mock or a replaced \`fetch\`: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` as it is. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`. When the project has no MSW setup, do not add one or any other dependency: write the stories that need no network, and end your answer by telling the user which stories, such as one for the page, would need a network mock, and that MSW would give them. Do not stop to ask.
      - Mock a module only for a dependency that is not a network call: register it in \`.storybook/preview.ts\` with \`sb.mock(import('../src/api.ts'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`."
    `);
  });
});
