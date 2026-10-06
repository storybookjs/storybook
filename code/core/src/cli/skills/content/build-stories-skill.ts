import { getToolName } from '../../../shared/open-service/toolset-names.ts';

export type StoriesSkillInputs = {
  framework: string;
  docsEnabled: boolean;
  testSupported: boolean;
  a11yEnabled: boolean;
  changeDetectionEnabled: boolean;
  moduleGraphSupported: boolean;
  reviewEnabled: boolean;
};

const ref = getToolName({ transport: 'cli' });

function docsSection(): string {
  return `## Look up components first

\`\`\`sh
${ref('docs.list')}             # every component and docs page, with its id
${ref('docs.show')} --id <id>   # props and usage examples of one entry
\`\`\`

Run \`docs list\` once at the start, then \`docs show\` for each component you build on or are asked about. Reuse what exists instead of building a duplicate. Answer props, API and usage questions from these commands, not from source files or \`node_modules\`: a prop that is not documented does not exist. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry too: \`--storybookId acme\`.`;
}

function writeSection(framework: string): string {
  return `## Write the component and its stories

Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; a callback passed as \`fn()\` must be asserted as called. The rules below are for the stories you write; do not rewrite existing stories only to match them.

- Import \`Meta\` and \`StoryObj\` from \`${framework}\`, and \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
- \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options.
- To mock a module, register it in \`.storybook/preview.ts\` with \`sb.mock(import('./api.ts'), { spy: true })\` (a relative path needs its file extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`. Always mock network and other external dependencies.`;
}

function testSection(a11yEnabled: boolean): string {
  const a11y = a11yEnabled
    ? '\n\nThe run also reports accessibility violations. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user.'
    : '';
  return `## Test

\`\`\`sh
${ref('test.run')} --stories '[{"storyId":"<id>"}]'   # leave out --stories to run every story
\`\`\`

Run this after every change, instead of a \`package.json\` test script. Use focused runs while iterating and one full run before you finish. Fix failures and rerun; never finish with failing tests.${a11y}`;
}

function discoverSection(inputs: StoriesSkillInputs): string {
  const commands = [
    inputs.changeDetectionEnabled &&
      `${ref('stories.changed')}   # stories affected by your uncommitted changes`,
    inputs.moduleGraphSupported &&
      `${ref('stories.findByComponent')} --componentPaths '["/abs/path/Button.tsx"]'   # stories that render these files`,
    inputs.docsEnabled && `${ref('docs.list')} --withStoryIds true   # every story id`,
  ].filter(Boolean);
  if (commands.length === 0) {
    return '';
  }
  const sharedFiles = inputs.moduleGraphSupported
    ? ' A shared file (design token, theme, util, hook) has no stories of its own: pass the components that use it to `find-by-component`.'
    : '';
  return `## Find the stories

\`\`\`sh
${commands.join('\n')}
\`\`\`

Run one of these before every review, also when a test run already listed the stories you wrote: they add the stories of other components that your change affects. Story ids come only from these commands. Never build one from a file name, a title or memory.${sharedFiles} When nothing is found, the component has no stories yet: say so, or write them.`;
}

function reviewSection(): string {
  return `## Finish with a review

\`\`\`sh
${ref('review.create')} --input '{
  "title": "Rounder buttons",
  "description": "The **Button** corner radius goes from 4px to 8px.",
  "collections": [
    { "title": "Button variants", "rationale": "The component that changed.", "storyIds": ["button--primary", "button--disabled"] },
    { "title": "Forms that use it", "rationale": "Where the change shows up in context.", "storyIds": ["login-form--default"] }
  ],
  "changedFiles": ["src/Button.tsx"]
}'
\`\`\`

Publish a review after every change the user can see, and again after each later change. It needs a running Storybook. Group the stories into one to five collections, from the changed component up to the pages that show it, and include every story you created. When the user asks to see or browse components or stories and no code changed, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed, and say that instead.

Then do both things the command prints, every time: open the review in the in-app browser with a browser tool, and end your answer with the review section it gives you. Do not list separate story links next to it.`;
}

function previewSection(reviewEnabled: boolean): string {
  const usage = `\`\`\`sh
${ref('stories.preview')} --stories '[{"storyId":"<id>"}]'   # direct links to stories
\`\`\``;
  return reviewEnabled
    ? `## Link to one story

${usage}

Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review.`
    : `## Finish with links

${usage}

After every change the user can see, end your answer with the links to the most relevant stories, at most five. It needs a running Storybook.`;
}

export function buildStoriesSkill(inputs: StoriesSkillInputs): string {
  return [
    `# Storybook workflow

Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. Each command prints what to do next; follow that too. Add \`--help\` to a command only when a call fails.`,
    inputs.docsEnabled && docsSection(),
    writeSection(inputs.framework),
    inputs.testSupported && testSection(inputs.a11yEnabled),
    discoverSection(inputs),
    inputs.reviewEnabled && reviewSection(),
    previewSection(inputs.reviewEnabled),
  ]
    .filter(Boolean)
    .join('\n\n');
}
