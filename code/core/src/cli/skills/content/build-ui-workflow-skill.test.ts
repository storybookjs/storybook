import { describe, expect, it } from 'vitest';

import { componentLookup } from './build-component-docs-skill.ts';
import { buildUiWorkflowSkill, type UiWorkflowSkillInputs } from './build-ui-workflow-skill.ts';

const everything: UiWorkflowSkillInputs = {
  transport: 'cli',
  framework: '@storybook/react-vite',
  csfFactories: false,
  previewFile: '.storybook/preview.ts',
  typescript: true,
  docsEnabled: true,
  testSupported: true,
  a11yEnabled: true,
  moduleGraphSupported: true,
  devEnabled: true,
};

// What `skills ui-workflow --mcp` renders when `main.ts` turns off the `dev` toolset of addon-mcp.
const withoutDev: UiWorkflowSkillInputs = {
  ...everything,
  transport: 'mcp',
  devEnabled: false,
  moduleGraphSupported: false,
};

describe('buildUiWorkflowSkill', () => {
  it('shows every command with its arguments when every feature is on', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('npx storybook tools docs show --id <id>');
    expect(text).toContain(`npx storybook tools test run --stories '[{"storyId":"<id>"}]'`);
    expect(text).toContain('npx storybook tools stories changed');
    expect(text).toContain(`npx storybook tools stories find-by-component --componentPaths '["`);
    expect(text).toContain(`npx storybook tools review create --input '{`);
    expect(text).toContain('accessibility violations');
  });

  it('includes the lookup of component-docs, so the agent cannot skip it', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain(`## Look up components first\n\n${componentLookup()}`);
    expect(text).not.toContain('npx storybook skills component-docs');
  });

  it('looks up components before it writes any', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text.indexOf('## Look up components first')).toBeLessThan(
      text.indexOf('## Write the component and its stories')
    );
  });

  it('never lets the agent instructions skip the component lookup', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('but always look up the components first');
  });

  it('looks up components only when the project has component docs', () => {
    const text = buildUiWorkflowSkill({ ...everything, docsEnabled: false });

    expect(text).not.toContain('Look up components first');
    expect(text).not.toContain('npx storybook tools docs show');
  });

  it('leaves out testing when the project cannot run story tests', () => {
    const text = buildUiWorkflowSkill({ ...everything, testSupported: false, a11yEnabled: false });

    expect(text).not.toContain('test run');
    expect(text).not.toContain('accessibility');
  });

  it('requires `stories changed` after the last edit before a review, not the full story list', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain(
      'Run `stories changed` after your last edit and before every review, also when you already know the ids'
    );
    expect(text).not.toContain('Run one of these');
  });

  it('ends the answer with the three review lines and opens no browser', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain(
      'Then end your answer with the three lines the command prints, unchanged: heading, text line and 👉 link, with nothing after them.'
    );
    expect(text).not.toContain('browser');
  });

  it('takes story ids from the story list when the builder has no module graph', () => {
    const text = buildUiWorkflowSkill({ ...everything, moduleGraphSupported: false });

    expect(text).toContain('docs list --withStoryIds true');
    expect(text).toContain('Story ids come only from the output of this command');
    expect(text).toContain('When it does not find a story');
    expect(text).not.toContain('stories changed');
    expect(text).not.toContain('find-by-component');
  });

  it('leaves out the review and the changed stories without the dev tools', () => {
    const text = buildUiWorkflowSkill(withoutDev);

    expect(text).toContain(
      'Follow this for every change to how the UI looks (components, stories, styles, themes, tokens). When'
    );
    expect(text).toContain('then one full run without `stories` before you finish.');
    expect(text).toContain('`docs-list` with `withStoryIds: true`');
    expect(text).not.toContain('stories-changed');
    expect(text).not.toContain('review-create');
    expect(text).not.toContain('stories-preview');
    expect(text).not.toContain('for example without the review');
  });

  it('leaves out finding the stories without the dev tools and the tests', () => {
    const text = buildUiWorkflowSkill({ ...withoutDev, testSupported: false });

    expect(text).not.toContain('## Find the stories');
    expect(text).not.toContain('## Test');
    expect(text).toContain('## Write the component and its stories');
  });

  it('finds the stories before it tests them, and runs every story before the review', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text.indexOf('## Find the stories')).toBeLessThan(text.indexOf('## Test'));
    expect(text).toContain('then one full run without `--stories` before the review');
    expect(text).toContain('so wait for it before you use an id');
  });

  it('keeps the accessibility test level of the project', () => {
    const text = buildUiWorkflowSkill(everything);

    expect(text).toContain('Never change the accessibility test level (`parameters.a11y.test`)');
  });

  it('selects stories by file and export when no command lists story ids', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      docsEnabled: false,
      moduleGraphSupported: false,
    });

    expect(text).toContain('"absoluteStoryPath"');
    expect(text).not.toContain('stories changed');
  });

  it('teaches CSF Factories instead of Meta and StoryObj when the preview uses definePreview', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      csfFactories: true,
      previewFile: '.storybook/preview.tsx',
    });

    expect(text).toContain('preview.meta({');
    expect(text).toContain('Do not import `Meta` or `StoryObj`');
    expect(text).not.toContain('Import `Meta` and `StoryObj`');
  });

  it('teaches Meta and StoryObj from the framework package otherwise', () => {
    const text = buildUiWorkflowSkill({ ...everything, framework: '@storybook/vue3-vite' });

    expect(text).toContain('Import `Meta` and `StoryObj` from `@storybook/vue3-vite`');
    expect(text).not.toContain('preview.meta({');
  });

  it('leaves out the Meta and StoryObj types in a JavaScript project', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      previewFile: '.storybook/preview.js',
      typescript: false,
    });

    expect(text).not.toContain('StoryObj');
    expect(text).toContain('- Import `fn`, `expect`, `mocked` and `sb` from `storybook/test`.');
    expect(text).toContain("sb.mock(import('../src/api.js')");
  });

  it('puts MSW before module mocks and names the preview file of the project', () => {
    const text = buildUiWorkflowSkill({ ...everything, previewFile: 'config/preview.tsx' });

    expect(text.indexOf('msw.use(')).toBeLessThan(text.indexOf('sb.mock('));
    expect(text).toContain('register it in `config/preview.tsx`');
  });

  it('tells how to set up MSW in the format of the project', () => {
    const csf3 = buildUiWorkflowSkill({ ...everything, previewFile: 'config/preview.tsx' });
    expect(csf3).toContain('never with a module mock or a replaced `fetch`');
    expect(csf3).toContain(
      "`loaders: [mswLoader()]` (`import { mswLoader } from 'msw-storybook-addon/csf3'`"
    );
    expect(csf3).toContain('to `config/preview.tsx`');

    const factories = buildUiWorkflowSkill({ ...everything, csfFactories: true });
    expect(factories).toContain(
      "`addons: [addonMsw()]` (`import addonMsw from 'msw-storybook-addon'`"
    );
    expect(factories).not.toContain('mswLoader');
  });
});

describe('buildUiWorkflowSkill over MCP', () => {
  const mcp = buildUiWorkflowSkill({ ...everything, transport: 'mcp' });

  it('states the same workflow, with the MCP tools instead of commands', () => {
    for (const heading of [
      '## Look up components first',
      '## Write the component and its stories',
      '## Find the stories',
      '## Test',
      '## Finish with a review',
    ]) {
      expect(mcp).toContain(heading);
    }
    expect(mcp).toContain('call `docs-list` once and read its result');
    expect(mcp).toContain(
      '`stories-find-by-component` with `componentPaths: ["/abs/path/Button.tsx"]`'
    );
    expect(mcp).toContain('`test-run` with `stories: [{ "storyId": "<id>" }]`');
    expect(mcp).toContain('Call `review-create` with:');
    expect(mcp).toContain('pass the source of the entry as `storybookId: "acme"`');
    expect(mcp).not.toContain('npx storybook tools');
    expect(mcp).not.toMatch(
      /--(id|storyId|storybookId|stories|input|componentPaths|maxDistance|withStoryIds)\b/
    );
  });

  it('keeps the rules that are not about commands word for word', () => {
    const cli = buildUiWorkflowSkill(everything);
    const section = (text: string, heading: string) =>
      text.slice(text.indexOf(heading), text.indexOf('\n## ', text.indexOf(heading) + 1));

    expect(section(mcp, '## Write the component and its stories')).toBe(
      section(cli, '## Write the component and its stories')
    );
    expect(mcp).toContain(
      'Then end your answer with the three lines its result gives you, unchanged: heading, text line and 👉 link, with nothing after them.'
    );
  });

  it('asks for no shell habits that MCP tools do not have', () => {
    expect(mcp).not.toContain('`head`');
    expect(mcp).not.toContain('in its own command');
    expect(mcp).not.toContain('--help');
  });
});

// The CLI text is the one the plugin evals validated, and the MCP text shares its sentences, so a
// wording change for one transport must show up here for both.
describe('buildUiWorkflowSkill full text', () => {
  it('on the CLI', () => {
    expect(buildUiWorkflowSkill(everything)).toMatchInlineSnapshot(`
      "# Storybook UI workflow

      Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. When the project's agent instructions (such as \`AGENTS.md\`) describe this workflow without some of its steps, for example without the review, skip those steps, but always look up the components first. Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.

      ## Look up components first

      \`\`\`sh
      npx storybook tools docs list             # every component and docs page, with its id
      npx storybook tools docs show --id <id>   # props and usage examples of one entry
      npx storybook tools docs show-story --storyId <id>   # the code of a story that docs show only lists
      \`\`\`

      Do this before you edit any file: run \`docs list\` once and read its output, then run \`docs show\` with an id from that output for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that \`docs show\` documents, never one you assume from a name or another library. Run \`docs show\` once per id, each in its own command, and read its whole output without \`head\` or \`tail\`: the props often come after long story examples. Answer props, API and usage questions from these commands. Read source files or \`node_modules\` only when the commands return nothing relevant. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry to both commands that show it: \`--storybookId acme\`.

      ## Write the component and its stories

      Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

      - Import \`Meta\` and \`StoryObj\` from \`@storybook/react-vite\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
      - \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options; to check a disabled element, assert \`toBeDisabled()\` instead of clicking it.
      - A story never calls a real service. Mock network requests with MSW, never with a module mock or a replaced \`fetch\`: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` as it is. When the project has no \`msw-storybook-addon\` yet, set it up first: install \`msw\` and \`msw-storybook-addon\` as dev dependencies, run \`npx msw init ./public --save\` (\`../public\` has to be in \`staticDirs\` of the main config), and add \`loaders: [mswLoader()]\` (\`import { mswLoader } from 'msw-storybook-addon/csf3'\`, without an \`initialize()\` call) to \`.storybook/preview.ts\`. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`.
      - Mock a module only for a dependency that is not a network call: register it in \`.storybook/preview.ts\` with \`sb.mock(import('../src/api.ts'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.

      ## Find the stories

      \`\`\`sh
      npx storybook tools stories changed   # stories affected by your uncommitted changes
      npx storybook tools stories find-by-component --componentPaths '["/abs/path/Button.tsx"]'   # only for files stories changed leaves out
      npx storybook tools docs list --withStoryIds true   # every story id
      \`\`\`

      Run \`stories changed\` after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects. The list covers your edits so far, so checks in between, such as a type check, need no new call. Story ids come only from the output of these commands, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When \`stories changed\` leaves out a file you touched, pass that file to \`find-by-component\`, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When \`find-by-component\` reports stories hidden by \`maxDistance\`, rerun it with a higher \`--maxDistance\`. When none of them finds a story for a component, it has no stories yet: say so, or write them.

      ## Test

      \`\`\`sh
      npx storybook tools test run --stories '[{"storyId":"<id>"}]'   # ids from "Find the stories"; leave out --stories to run every story
      \`\`\`

      Run this after every change: focused runs with \`--stories\` while you iterate, then one full run without \`--stories\` before the review. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass.

      ## Finish with a review

      \`\`\`sh
      npx storybook tools review create --input '{
        "title": "Rounder buttons",
        "description": "The **Button** corner radius goes from 4px to 8px.",
        "collections": [
          { "title": "Button variants", "rationale": "The component that changed.", "storyIds": ["button--primary", "button--disabled"] },
          { "title": "Forms that use it", "rationale": "Where the change shows up in context.", "storyIds": ["login-form--default"] }
        ],
        "changedFiles": ["src/Button.tsx"]
      }'
      \`\`\`

      Publish a review after every change the user can see, and again after each later change. It needs a running Storybook. When you changed files, take the story ids from \`stories changed\`, run after your last edit (and from \`find-by-component\` only for a file it leaves out), also when you only wrote stories; never take them from the test output. Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. List every file you created or changed in \`changedFiles\`, story files too. When the user only asks to see or browse components or stories and you changed no files, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed, such as a change to a callback, tests or types, and the user did not ask to see anything, and say that instead.

      Publish it as your last step, after your other checks such as a type check, lint or \`git status\`. Then end your answer with the three lines the command prints, unchanged: heading, text line and 👉 link, with nothing after them. Do not list separate story links next to them or repeat the review link elsewhere in your answer.

      ## Link to one story

      \`\`\`sh
      npx storybook tools stories preview --stories '[{"storyId":"<id>"}]'   # direct links to stories
      \`\`\`

      Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless \`review create\` keeps failing after you fixed what it reported: then share these links and say why."
    `);
  });

  it('over MCP without the dev toolset', () => {
    expect(buildUiWorkflowSkill(withoutDev)).toMatchInlineSnapshot(`
      "# Storybook UI workflow

      Follow this for every change to how the UI looks (components, stories, styles, themes, tokens). When the project's agent instructions (such as \`AGENTS.md\`) describe this workflow without some of its steps, skip those steps, but always look up the components first. The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      ## Look up components first

      - \`docs-list\`: every component and docs page, with its id
      - \`docs-show\` with an \`id\`: props and usage examples of one entry
      - \`docs-show-story\` with a \`storyId\`: the code of a story that \`docs-show\` only lists

      Do this before you edit any file: call \`docs-list\` once and read its result, then call \`docs-show\` with an id from that result for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that \`docs-show\` documents, never one you assume from a name or another library. Call \`docs-show\` once per id and read its whole result: the props often come after long story examples. Answer props, API and usage questions from these tools. Read source files or \`node_modules\` only when the tools return nothing relevant. When \`docs-list\` groups its entries under sources (\`id: acme\`), pass the source of the entry as \`storybookId: "acme"\` to \`docs-show\` and \`docs-show-story\`.

      ## Write the component and its stories

      Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

      - Import \`Meta\` and \`StoryObj\` from \`@storybook/react-vite\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
      - \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options; to check a disabled element, assert \`toBeDisabled()\` instead of clicking it.
      - A story never calls a real service. Mock network requests with MSW, never with a module mock or a replaced \`fetch\`: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` as it is. When the project has no \`msw-storybook-addon\` yet, set it up first: install \`msw\` and \`msw-storybook-addon\` as dev dependencies, run \`npx msw init ./public --save\` (\`../public\` has to be in \`staticDirs\` of the main config), and add \`loaders: [mswLoader()]\` (\`import { mswLoader } from 'msw-storybook-addon/csf3'\`, without an \`initialize()\` call) to \`.storybook/preview.ts\`. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`.
      - Mock a module only for a dependency that is not a network call: register it in \`.storybook/preview.ts\` with \`sb.mock(import('../src/api.ts'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.

      ## Find the stories

      - \`docs-list\` with \`withStoryIds: true\`: every story id

      Story ids come only from the result of this tool, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When it does not find a story for a component, it has no stories yet: say so, or write them.

      ## Test

      - \`test-run\` with \`stories: [{ "storyId": "<id>" }]\`: ids from "Find the stories"; leave out \`stories\` to run every story

      Call \`test-run\` after every change: focused runs with \`stories\` while you iterate, then one full run without \`stories\` before you finish. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass."
    `);
  });

  it('over MCP', () => {
    expect(buildUiWorkflowSkill({ ...everything, transport: 'mcp' })).toMatchInlineSnapshot(`
      "# Storybook UI workflow

      Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. When the project's agent instructions (such as \`AGENTS.md\`) describe this workflow without some of its steps, for example without the review, skip those steps, but always look up the components first. The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      ## Look up components first

      - \`docs-list\`: every component and docs page, with its id
      - \`docs-show\` with an \`id\`: props and usage examples of one entry
      - \`docs-show-story\` with a \`storyId\`: the code of a story that \`docs-show\` only lists

      Do this before you edit any file: call \`docs-list\` once and read its result, then call \`docs-show\` with an id from that result for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that \`docs-show\` documents, never one you assume from a name or another library. Call \`docs-show\` once per id and read its whole result: the props often come after long story examples. Answer props, API and usage questions from these tools. Read source files or \`node_modules\` only when the tools return nothing relevant. When \`docs-list\` groups its entries under sources (\`id: acme\`), pass the source of the entry as \`storybookId: "acme"\` to \`docs-show\` and \`docs-show-story\`.

      ## Write the component and its stories

      Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

      - Import \`Meta\` and \`StoryObj\` from \`@storybook/react-vite\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
      - \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options; to check a disabled element, assert \`toBeDisabled()\` instead of clicking it.
      - A story never calls a real service. Mock network requests with MSW, never with a module mock or a replaced \`fetch\`: give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` as it is. When the project has no \`msw-storybook-addon\` yet, set it up first: install \`msw\` and \`msw-storybook-addon\` as dev dependencies, run \`npx msw init ./public --save\` (\`../public\` has to be in \`staticDirs\` of the main config), and add \`loaders: [mswLoader()]\` (\`import { mswLoader } from 'msw-storybook-addon/csf3'\`, without an \`initialize()\` call) to \`.storybook/preview.ts\`. Read the version of \`msw-storybook-addon\` in the project's \`package.json\`: only before version 3 do stories have no \`msw\` in \`beforeEach\` and take \`parameters: { msw: { handlers: [...] } }\` instead. From version 3 on, never write \`parameters.msw\`.
      - Mock a module only for a dependency that is not a network call: register it in \`.storybook/preview.ts\` with \`sb.mock(import('../src/api.ts'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.

      ## Find the stories

      - \`stories-changed\`: stories affected by your uncommitted changes
      - \`stories-find-by-component\` with \`componentPaths: ["/abs/path/Button.tsx"]\`: only for files \`stories-changed\` leaves out
      - \`docs-list\` with \`withStoryIds: true\`: every story id

      Call \`stories-changed\` after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects. The list covers your edits so far, so checks in between, such as a type check, need no new call. Story ids come only from the result of these tools, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When \`stories-changed\` leaves out a file you touched, pass that file to \`stories-find-by-component\`, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When \`stories-find-by-component\` reports stories hidden by \`maxDistance\`, call it again with a higher \`maxDistance\`. When none of them finds a story for a component, it has no stories yet: say so, or write them.

      ## Test

      - \`test-run\` with \`stories: [{ "storyId": "<id>" }]\`: ids from "Find the stories"; leave out \`stories\` to run every story

      Call \`test-run\` after every change: focused runs with \`stories\` while you iterate, then one full run without \`stories\` before the review. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.

      The run lists accessibility violations under \`## Accessibility Violations\`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (\`parameters.a11y.test\`) to make violations fail or pass.

      ## Finish with a review

      Call \`review-create\` with:

      \`\`\`json
      {
        "title": "Rounder buttons",
        "description": "The **Button** corner radius goes from 4px to 8px.",
        "collections": [
          { "title": "Button variants", "rationale": "The component that changed.", "storyIds": ["button--primary", "button--disabled"] },
          { "title": "Forms that use it", "rationale": "Where the change shows up in context.", "storyIds": ["login-form--default"] }
        ],
        "changedFiles": ["src/Button.tsx"]
      }
      \`\`\`

      Publish a review after every change the user can see, and again after each later change. When you changed files, take the story ids from \`stories-changed\`, called after your last edit (and from \`stories-find-by-component\` only for a file it leaves out), also when you only wrote stories; never take them from the test result. Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. List every file you created or changed in \`changedFiles\`, story files too. When the user only asks to see or browse components or stories and you changed no files, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed, such as a change to a callback, tests or types, and the user did not ask to see anything, and say that instead.

      Publish it as your last step, after your other checks such as a type check, lint or \`git status\`. Then end your answer with the three lines its result gives you, unchanged: heading, text line and 👉 link, with nothing after them. Do not list separate story links next to them or repeat the review link elsewhere in your answer.

      ## Link to one story

      - \`stories-preview\` with \`stories: [{ "storyId": "<id>" }]\`: direct links to stories

      Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless \`review-create\` keeps failing after you fixed what it reported: then share these links and say why."
    `);
  });

  it('over MCP without a tool that lists story ids', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      transport: 'mcp',
      docsEnabled: false,
      moduleGraphSupported: false,
    });
    expect(text.slice(text.indexOf('## Find the stories'), text.indexOf('## Test')))
      .toMatchInlineSnapshot(`
      "## Find the stories

      This Storybook has no tool that lists story ids. Select a story by its file and export instead: \`stories: [{ "absoluteStoryPath": "/abs/path/Button.stories.tsx", "exportName": "Primary" }]\`.

      "
    `);
  });

  it('over MCP with docs but without a module graph', () => {
    const text = buildUiWorkflowSkill({
      ...everything,
      transport: 'mcp',
      moduleGraphSupported: false,
    });
    expect(text.slice(text.indexOf('## Find the stories'), text.indexOf('## Test')))
      .toMatchInlineSnapshot(`
      "## Find the stories

      - \`docs-list\` with \`withStoryIds: true\`: every story id

      Story ids come only from the result of this tool, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When it does not find a story for a component, it has no stories yet: say so, or write them.

      "
    `);
  });
});
