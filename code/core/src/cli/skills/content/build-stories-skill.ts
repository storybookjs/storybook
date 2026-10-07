import { getToolName } from '../../../shared/open-service/toolset-names.ts';

export type StoriesSkillInputs = {
  framework: string;
  /** The preview file uses `definePreview`, so story files use CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file, relative to the working directory. */
  previewFile: string;
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
${ref('docs.showStory')} --storyId <id>   # the code of a story that docs show only lists
\`\`\`

Run \`docs list\` once at the start, then \`docs show\` for every listed component you use, even one you only add such as a button, and for each one you are asked about. Reuse what exists instead of building a duplicate. Use only the props that \`docs show\` documents, never one you assume from a name or another library, and answer props, API and usage questions from these commands. Read source files or \`node_modules\` only when the commands return nothing relevant. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry to both commands that show it: \`--storybookId acme\`.`;
}

function writeSection({ framework, csfFactories, previewFile }: StoriesSkillInputs): string {
  const format = csfFactories
    ? `This project writes stories with CSF Factories, because \`${previewFile}\` uses \`definePreview\`: \`import preview from '../.storybook/preview'\` (the path to that file), then \`const meta = preview.meta({ component: Button })\` and \`export const Primary = meta.story({ args: { ... } })\`. Do not import \`Meta\` or \`StoryObj\`. Import`
    : `Import \`Meta\` and \`StoryObj\` from \`${framework}\`, and`;
  return `## Write the component and its stories

Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. Never export a story under the name of a global such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`. An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

- ${format} \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
- \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. \`userEvent.click(element)\` takes no options.
- A story never calls a real service. Mock network requests with MSW when the project has it (\`msw-storybook-addon\` in \`${previewFile}\`): give the story \`beforeEach({ msw }) { msw.use(http.get('/api/users', () => HttpResponse.json([...]))) }\`, and leave the code that calls \`fetch\` unmocked. Only version 2 of that addon has no \`msw\` there: it takes \`parameters: { msw: { handlers: [...] } }\`.
- Mock a module only for what MSW cannot reach (no MSW in the project, or a dependency that is not a network call): register it in \`${previewFile}\` with \`sb.mock(import('../src/api.ts'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.`;
}

function testSection(a11yEnabled: boolean): string {
  const a11y = a11yEnabled
    ? '\n\nThe run also reports accessibility violations. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user.'
    : '';
  return `## Test

\`\`\`sh
${ref('test.run')} --stories '[{"storyId":"<id>"}]'   # ids: see "Find the stories"; leave out --stories to run every story
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
    return `## Find the stories

This project has no command that lists story ids. Select a story by its file and export instead: \`--stories '[{"absoluteStoryPath":"/abs/path/Button.stories.tsx","exportName":"Primary"}]'\`.`;
  }
  const before = inputs.reviewEnabled ? 'before every review' : 'before you share links';
  const sharedFile = '(design token, theme, util, hook)';
  const fallback = !inputs.moduleGraphSupported
    ? []
    : [
        inputs.changeDetectionEnabled
          ? `When \`stories changed\` leaves out a file you touched, pass that file to \`find-by-component\`; for a shared file ${sharedFile}, which has no stories of its own, pass the components that use it.`
          : `A shared file ${sharedFile} has no stories of its own: pass the components that use it to \`find-by-component\`.`,
        'When \`find-by-component\` reports stories hidden by \`maxDistance\`, rerun it with a higher \`--maxDistance\`.',
      ];
  const affected = [
    inputs.changeDetectionEnabled && '`stories changed`',
    inputs.moduleGraphSupported && '`find-by-component`',
  ].filter(Boolean);
  const several = commands.length > 1;
  const guidance = [
    affected.length > 0
      ? `Run ${affected.join(' or ')} ${before}, also when you already know the ids of the stories you wrote: ${affected.length > 1 ? 'they add' : 'it adds'} the stories of other components that your change affects.`
      : `Run it ${before}.`,
    `Story ids come only from ${several ? 'these commands' : 'this command'}. Never build one from a file name, a title or memory.`,
    ...fallback,
    `When ${several ? 'none of them finds' : 'it does not find'} a story for a component, it has no stories yet: say so, or write them.`,
  ].join(' ');
  return `## Find the stories

\`\`\`sh
${commands.join('\n')}
\`\`\`

${guidance}`;
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

Publish a review after every change the user can see, and again after each later change. It needs a running Storybook. Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. When the user asks to see or browse components or stories and no code changed, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed and the user did not ask to see anything, and say that instead.

Then do both things the command prints, every time: open the review in the in-app browser with a browser tool, and end your answer with the review section it gives you. Do not list separate story links next to it.`;
}

function previewSection(reviewEnabled: boolean): string {
  const usage = `\`\`\`sh
${ref('stories.preview')} --stories '[{"storyId":"<id>"}]'   # direct links to stories
\`\`\``;
  return reviewEnabled
    ? `## Link to one story

${usage}

Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless \`review create\` keeps failing after you fixed what it reported: then share these links and say why.`
    : `## Finish with links

${usage}

After every change the user can see, end your answer with the links to the most relevant stories, at most five. It needs a running Storybook.`;
}

export function buildStoriesSkill(inputs: StoriesSkillInputs): string {
  return [
    `# Storybook workflow

Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.`,
    inputs.docsEnabled && docsSection(),
    writeSection(inputs),
    inputs.testSupported && testSection(inputs.a11yEnabled),
    discoverSection(inputs),
    inputs.reviewEnabled && reviewSection(),
    previewSection(inputs.reviewEnabled),
  ]
    .filter(Boolean)
    .join('\n\n');
}
