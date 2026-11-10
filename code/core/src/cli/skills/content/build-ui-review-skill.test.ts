import { describe, expect, it } from 'vitest';

import { buildUiReviewSkill, type UiReviewSkillInputs } from './build-ui-review-skill.ts';

const everything: UiReviewSkillInputs = {
  transport: 'cli',
  docsEnabled: true,
  moduleGraphSupported: true,
  devEnabled: true,
};

describe('buildUiReviewSkill', () => {
  it('requires `stories changed` after the last edit before a review, not the full story list', () => {
    const text = buildUiReviewSkill(everything);

    expect(text).toContain(
      'Run `stories changed` after your last edit and before every review, also when you already know the ids'
    );
    expect(text.indexOf('## Find the stories')).toBeLessThan(text.indexOf('## Publish the review'));
  });

  it('falls back to find-by-component for a file that `stories changed` leaves out', () => {
    const text = buildUiReviewSkill(everything);

    expect(text).toContain(`npx storybook tools stories find-by-component --componentPaths '["`);
    expect(text).toContain('rerun it with a higher `--maxDistance`');
  });

  it('ends the answer with the three review lines and opens no browser', () => {
    const text = buildUiReviewSkill(everything);

    expect(text).toContain(
      'Then end your answer with the three lines the command prints, unchanged: heading, text line and 👉 link, with nothing after them.'
    );
    expect(text).not.toContain('browser');
  });

  it('takes story ids from the story list when the builder has no module graph', () => {
    const text = buildUiReviewSkill({ ...everything, moduleGraphSupported: false });

    expect(text).toContain('docs list --withStoryIds true');
    expect(text).toContain('When it does not find a story');
    expect(text).not.toContain('stories changed');
    expect(text).not.toContain('find-by-component');
  });

  it('tells the agent to skip the step when the MCP server has no review tool', () => {
    expect(
      buildUiReviewSkill({
        ...everything,
        transport: 'mcp',
        devEnabled: false,
        moduleGraphSupported: false,
      })
    ).toMatchInlineSnapshot(`
      "# Storybook UI review

      The Storybook MCP server of this project cannot publish a review: its \`dev\` toolset is off. Skip this step."
    `);
  });

  it('names no other skill', () => {
    expect(buildUiReviewSkill(everything)).not.toMatch(/component-docs|write-stories|test-stories/);
  });

  it('asks for no shell habits that MCP tools do not have', () => {
    const mcp = buildUiReviewSkill({ ...everything, transport: 'mcp' });

    expect(mcp).toContain('Call `review-create` with:');
    expect(mcp).toContain(
      '`stories-find-by-component` with `componentPaths: ["/abs/path/Button.tsx"]`'
    );
    expect(mcp).toContain(
      'Then end your answer with the three lines its result gives you, unchanged: heading, text line and 👉 link, with nothing after them.'
    );
    expect(mcp).not.toContain('npx storybook tools');
    expect(mcp).not.toMatch(/--(stories|input|componentPaths|maxDistance|withStoryIds|help)\b/);
  });

  // The CLI text is the one the plugin evals validated, and the MCP text shares its sentences, so
  // a wording change for one transport must show up here for both.
  it('full text on the CLI', () => {
    expect(buildUiReviewSkill(everything)).toMatchInlineSnapshot(`
      "# Storybook UI review

      Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.

      ## Find the stories

      \`\`\`sh
      npx storybook tools stories changed   # stories affected by your uncommitted changes
      npx storybook tools stories find-by-component --componentPaths '["/abs/path/Button.tsx"]'   # only for files stories changed leaves out
      npx storybook tools docs list --withStoryIds true   # every story id
      \`\`\`

      Run \`stories changed\` after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects. The list covers your edits so far, so checks in between, such as a type check, need no new call. Story ids come only from the output of these commands, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When \`stories changed\` leaves out a file you touched, pass that file to \`find-by-component\`, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When \`find-by-component\` reports stories hidden by \`maxDistance\`, rerun it with a higher \`--maxDistance\`. When none of them finds a story for a component, it has no stories yet: say so, or write them.

      ## Publish the review

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

      Publish it as your last step, after your other checks such as the story tests, a type check, lint or \`git status\`. Then end your answer with the three lines the command prints, unchanged: heading, text line and 👉 link, with nothing after them. Do not list separate story links next to them or repeat the review link elsewhere in your answer.

      ## Link to one story

      \`\`\`sh
      npx storybook tools stories preview --stories '[{"storyId":"<id>"}]'   # direct links to stories
      \`\`\`

      Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless \`review create\` keeps failing after you fixed what it reported: then share these links and say why."
    `);
  });

  it('full text over MCP', () => {
    expect(buildUiReviewSkill({ ...everything, transport: 'mcp' })).toMatchInlineSnapshot(`
      "# Storybook UI review

      The tools named here are tools of the Storybook MCP server. Some tools return what to do next; follow that too.

      ## Find the stories

      - \`stories-changed\`: stories affected by your uncommitted changes
      - \`stories-find-by-component\` with \`componentPaths: ["/abs/path/Button.tsx"]\`: only for files \`stories-changed\` leaves out
      - \`docs-list\` with \`withStoryIds: true\`: every story id

      Call \`stories-changed\` after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects. The list covers your edits so far, so checks in between, such as a type check, need no new call. Story ids come only from the result of these tools, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory. When \`stories-changed\` leaves out a file you touched, pass that file to \`stories-find-by-component\`, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When \`stories-find-by-component\` reports stories hidden by \`maxDistance\`, call it again with a higher \`maxDistance\`. When none of them finds a story for a component, it has no stories yet: say so, or write them.

      ## Publish the review

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

      Publish it as your last step, after your other checks such as the story tests, a type check, lint or \`git status\`. Then end your answer with the three lines its result gives you, unchanged: heading, text line and 👉 link, with nothing after them. Do not list separate story links next to them or repeat the review link elsewhere in your answer.

      ## Link to one story

      - \`stories-preview\` with \`stories: [{ "storyId": "<id>" }]\`: direct links to stories

      Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless \`review-create\` keeps failing after you fixed what it reported: then share these links and say why."
    `);
  });
});
