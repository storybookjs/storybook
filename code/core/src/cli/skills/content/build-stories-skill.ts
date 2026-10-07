import { getToolName } from '../../../shared/open-service/toolset-names.ts';

export type StoriesSkillInputs = {
  framework: string;
  renderer?: string;
  /** The preview file uses `definePreview`, so new story files use CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file, relative to the working directory. */
  previewFile: string;
  typescript: boolean;
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

Run \`docs list\` once at the start, then \`docs show\` for each component you build on or are asked about. Reuse what exists instead of building a duplicate. Answer props, API and usage questions from these commands and never invent a prop. Read source files or \`node_modules\` only when the commands return nothing relevant. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry to both commands that show it: \`--storybookId acme\`.`;
}

const INFERS_ARGS_FROM_COMPONENT = [
  '@storybook/react',
  '@storybook/preact',
  '@storybook/vue3',
  '@storybook/svelte',
];

function storyFormat({
  framework,
  renderer,
  csfFactories,
  previewFile,
  typescript,
}: StoriesSkillInputs) {
  if (csfFactories) {
    return `New story files use CSF Factories, because \`${previewFile}\` uses \`definePreview\`:

\`\`\`ts
import preview from '../.storybook/preview'; // the path to ${previewFile}, or '#.storybook/preview' when other story files import it that way
import { expect, fn } from 'storybook/test';

import { Button } from './Button';

const meta = preview.meta({ component: Button, args: { onClick: fn() } });

export const Primary = meta.story({ args: { label: 'Save' } });

export const Disabled = Primary.extend({
  args: { disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).not.toHaveBeenCalled();
  },
});
\`\`\`

Types come from \`preview\`: no \`Meta\` or \`StoryObj\` import and no default export. A file that still uses \`Meta\` and \`StoryObj\` (CSF 3) stays that way.`;
  }
  const typedMeta = INFERS_ARGS_FROM_COMPONENT.includes(renderer ?? framework)
    ? `const meta = { component: Button, args: { onClick: fn() } } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;`
    : `const meta: Meta = { component: Button, args: { onClick: fn() } }; // type Meta and StoryObj as other story files do
export default meta;
type Story = StoryObj;`;
  const example = typescript
    ? `import type { Meta, StoryObj } from '${framework}';
import { expect, fn } from 'storybook/test';

import { Button } from './Button';

${typedMeta}

export const Primary: Story = { args: { label: 'Save' } };

export const Disabled: Story = {`
    : `import { expect, fn } from 'storybook/test';

import { Button } from './Button';

export default { component: Button, args: { onClick: fn() } };

export const Primary = { args: { label: 'Save' } };

export const Disabled = {`;
  return `New story files use CSF 3:

\`\`\`${typescript ? 'ts' : 'js'}
${example}
  args: { ...Primary.args, disabled: true },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
\`\`\`

Do not switch \`${previewFile}\` to \`definePreview\` (CSF Factories) yourself; when a file already uses \`preview.meta()\`, keep that format.`;
}

function rendererNote(renderer: string | undefined): string {
  if (renderer === '@storybook/svelte') {
    return '\n- Svelte: when the project has `*.stories.svelte` files, write those (`defineMeta` and `<Story>`, as the existing files do) instead of the format above.';
  }
  if (renderer === '@storybook/web-components') {
    return '\n- Web components: `canvas` queries do not reach into shadow DOM. Query through `element.shadowRoot`, or with `shadow-dom-testing-library` when the project has it.';
  }
  return '';
}

function writeSection(inputs: StoriesSkillInputs): string {
  const { previewFile } = inputs;
  return `## Write the component and its stories

Every component you create or change gets stories, in its existing story file when it has one. When you remove or rename a component, a prop or a state, update or delete the stories that used it.

This project's own files come first. Existing story files show the format, location, naming and \`tags\`; \`${previewFile}\` and existing stories show the setup a component needs (providers, router, theme). Follow them, and use the rules below for what they do not show. A story file keeps the format it has: never mix two formats in one file, and do not rewrite existing stories only to match these rules.

What to cover: one story per state that changes what the user sees or can do (variants, loading, empty, error, invalid input, disabled, permissions, long or missing content), not one per prop value. Name each story after its scenario and give it realistic data. An interactive component also gets \`play\` functions that use it as a user would (click, type, keyboard, submit) and assert what the user then sees; for an arg passed as \`fn()\`, assert that it was or was not called. Build with semantic elements and labels, so stories can be queried by role.

${storyFormat(inputs)}

- \`fn\`, \`expect\`, \`mocked\`, \`sb\` and \`screen\` come from \`storybook/test\`. In \`play\`, take \`canvas\` and \`userEvent\` from the context and query \`canvas\` by role or label; it already has the queries, so never \`within(canvas)\`. \`await\` every \`userEvent\` call and \`expect\`, and use \`findBy*\` or \`waitFor\` for what appears later. For content rendered outside the story (dialog, popover, toast), use \`screen\`.
- A component that needs a provider, router or theme gets \`decorators\`, in \`${previewFile}\` when every story needs it. Check what that file already provides before you add one.
- A story never reaches the network or another external service. Use the mocking this project already has (for example MSW handlers); otherwise mock the module that makes the call.
- To mock a module, register it once in \`${previewFile}\` with \`sb.mock(import('../src/api.${inputs.typescript ? 'ts' : 'js'}'), { spy: true })\`: the path is relative to that file, with its extension and without an alias. Then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.
- Do not name an export after a global the file may use, such as \`Error\`: export \`ErrorState\` and set \`name: 'Error'\`.${rendererNote(inputs.renderer)}`;
}

function testSection({ testSupported, a11yEnabled }: StoriesSkillInputs): string {
  if (!testSupported) {
    return `## Test

This project cannot run story tests: \`@storybook/addon-vitest\` is not set up. Say so in your answer and do not claim the stories are tested.`;
  }
  const a11y = a11yEnabled
    ? '\n\nThe run also reports accessibility violations. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user.'
    : '';
  return `## Test

\`\`\`sh
${ref('test.run')} --stories '[{"storyId":"<id>"}]'   # ids: see "Find the stories"; leave out --stories to run every story
\`\`\`

Run this after every change; a \`package.json\` script does not replace it for story tests. Use focused runs while iterating and one full run before you finish. Fix the cause of a failure, not the assertion, and rerun; never finish with failing tests that your change caused. Report failures that were there before your change, or that you cannot fix after a few attempts, instead of hiding them.${a11y}`;
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

This project has no command that lists story ids. Select a story by its file and export instead: \`--stories '[{"absoluteStoryPath":"/abs/path/Button.stories.tsx","exportName":"Primary"}]'\`. Add \`"explicitStoryName"\` when the story sets a \`name\`.`;
  }
  const before = inputs.reviewEnabled ? 'before every review' : 'before you share links';
  const sharedFile = '(design token, theme, util, hook)';
  const fallback = !inputs.moduleGraphSupported
    ? []
    : [
        inputs.changeDetectionEnabled
          ? `When \`stories changed\` leaves out a file you touched, pass that file to \`find-by-component\`; for a shared file ${sharedFile}, which has no stories of its own, pass the components that use it.`
          : `A shared file ${sharedFile} has no stories of its own: pass the components that use it to \`find-by-component\`.`,
        `\`find-by-component\` lists stories by distance, from the stories of the file itself up to the pages that use it${inputs.reviewEnabled ? '; those layers make good review collections' : ''}. When it reports stories hidden by \`maxDistance\`, rerun it with a higher \`--maxDistance\`.`,
      ];
  const guidance = [
    `Run one of these ${before}, also when you already know the ids of the stories you wrote: they add the stories of other components that your change affects.`,
    'Story ids come only from these commands. Never build one from a file name, a title or memory.',
    ...fallback,
    'When none of them finds a story for a component, it has no stories yet: say so, or write them.',
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

Publish a review after every change the user can see, and again after each later change. It needs a running Storybook. Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. When the user asks to see or browse components or stories and no code changed, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed and the user did not ask to see anything, or when the user asked for no review, and say that instead.

In a follow-up review, keep the collections and their order stable. Add a story where the change should not be visible, as a control. Titles and rationales are plain text without em-dashes. To the user, say "group of stories", not "collection".

Then do both things the command prints, every time: open the review in the in-app browser with a browser tool (skip this only when you have no such tool), and end your answer with the review section it describes. Do not list separate story links next to it.`;
}

function previewSection(reviewEnabled: boolean): string {
  const usage = `\`\`\`sh
${ref('stories.preview')} --stories '[{"storyId":"<id>"}]'   # direct links to stories
\`\`\``;
  return reviewEnabled
    ? `## Link to one story

${usage}

Only for a look at one story while you iterate, or when the user asks for a direct link. It needs a running Storybook. Add \`"globals": {"theme": "dark"}\` or \`"props": {...}\` to an item to see the story under other settings. It does not replace the review, unless \`review create\` keeps failing after you fixed what it reported: then share these links and say why.`
    : `## Finish with links

${usage}

After every change the user can see, end your answer with the links to the most relevant stories, at most five. It needs a running Storybook. Add \`"globals": {"theme": "dark"}\` or \`"props": {...}\` to an item to see the story under other settings.`;
}

export function buildStoriesSkill(inputs: StoriesSkillInputs): string {
  return [
    `# Storybook workflow

Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.`,
    inputs.docsEnabled && docsSection(),
    writeSection(inputs),
    testSection(inputs),
    discoverSection(inputs),
    inputs.reviewEnabled && reviewSection(),
    previewSection(inputs.reviewEnabled),
  ]
    .filter(Boolean)
    .join('\n\n');
}
