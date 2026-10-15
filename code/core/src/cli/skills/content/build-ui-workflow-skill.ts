import { componentLookup, MCP_TOOLS_NOTE } from './build-component-docs-skill.ts';
import {
  type SkillTextTransport,
  type SkillVocabulary,
  skillVocabulary,
} from './skill-vocabulary.ts';
import { ERROR_EXPORT_RULE, networkMockRule, USER_EVENT_RULE } from './story-rules.ts';

export type UiWorkflowSkillInputs = {
  /**
   * `cli` for `storybook skills ui-workflow`, `mcp` for the same command with `--mcp`: the same
   * workflow, in commands to run or in tools of the Storybook MCP server to call.
   */
  transport: SkillTextTransport;
  framework: string;
  /** The preview file uses `definePreview`, so story files use CSF Factories. */
  csfFactories: boolean;
  /** Path of the preview file, relative to the working directory. */
  previewFile: string;
  typescript: boolean;
  docsEnabled: boolean;
  testSupported: boolean;
  a11yEnabled: boolean;
  moduleGraphSupported: boolean;
};

function writeSection({
  framework,
  csfFactories,
  previewFile,
  typescript,
}: UiWorkflowSkillInputs): string {
  const format = csfFactories
    ? `This project writes stories with CSF Factories, because \`${previewFile}\` uses \`definePreview\`: \`import preview from '../.storybook/preview'\` (the path to that file), then \`const meta = preview.meta({ component: Button })\` and \`export const Primary = meta.story({ args: { ... } })\`. Do not import \`Meta\` or \`StoryObj\`. Import`
    : typescript
      ? `Import \`Meta\` and \`StoryObj\` from \`${framework}\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and`
      : 'Import';
  return `## Write the component and its stories

Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. ${ERROR_EXPORT_RULE} An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

- ${format} \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
- \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. ${USER_EVENT_RULE}
- ${networkMockRule({ csfFactories, previewFile })}
- Mock a module only for a dependency that is not a network call: register it in \`${previewFile}\` with \`sb.mock(import('../src/api.${typescript ? 'ts' : 'js'}'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.`;
}

function testSection(v: SkillVocabulary, a11yEnabled: boolean): string {
  const a11y = a11yEnabled
    ? '\n\nThe run lists accessibility violations under `## Accessibility Violations`. Fix semantic ones yourself (roles, labels, alt text, keyboard access). For visual ones such as color contrast, do not change the design: describe the problem, offer two or three options and ask the user. Never change the accessibility test level (`parameters.a11y.test`) to make violations fail or pass.'
    : '';
  const command = v.cli
    ? `\`\`\`sh
${v.ref('test.run')} --stories '[{"storyId":"<id>"}]'   # ids from "Find the stories"; leave out --stories to run every story
\`\`\``
    : `- ${v.name('test.run')} with \`stories: [{ "storyId": "<id>" }]\`: ids from "Find the stories"; leave out \`stories\` to run every story`;
  return `## Test

${command}

${v.cli ? 'Run this' : `Call ${v.name('test.run')}`} after every change: focused runs with ${v.flag('stories')} while you iterate, then one full run without ${v.flag('stories')} before the review. It is the only way to run story tests: never a \`package.json\` test script (such as \`npm run test:stories\`) or \`vitest\` directly, also when the user asks you to run the tests. Fix failures and rerun; never finish with failing tests. When you fix a failing test or an accessibility violation, change only what it needs.${a11y}`;
}

function discoverSection(v: SkillVocabulary, inputs: UiWorkflowSkillInputs): string {
  const changed = v.name('stories.changed');
  const findByComponent = v.name('stories.findByComponent');
  const commands = v.cli
    ? [
        inputs.moduleGraphSupported &&
          `${v.ref('stories.changed')}   # stories affected by your uncommitted changes`,
        inputs.moduleGraphSupported &&
          `${v.ref('stories.findByComponent')} --componentPaths '["/abs/path/Button.tsx"]'   # only for files stories changed leaves out`,
        inputs.docsEnabled && `${v.ref('docs.list')} --withStoryIds true   # every story id`,
      ].filter(Boolean)
    : [
        inputs.moduleGraphSupported && `- ${changed}: stories affected by your uncommitted changes`,
        inputs.moduleGraphSupported &&
          `- ${findByComponent} with \`componentPaths: ["/abs/path/Button.tsx"]\`: only for files ${changed} leaves out`,
        inputs.docsEnabled &&
          `- ${v.name('docs.list')} with \`withStoryIds: true\`: every story id`,
      ].filter(Boolean);
  if (commands.length === 0) {
    return v.cli
      ? `## Find the stories

This project has no command that lists story ids. Select a story by its file and export instead: \`--stories '[{"absoluteStoryPath":"/abs/path/Button.stories.tsx","exportName":"Primary"}]'\`.`
      : `## Find the stories

This Storybook has no tool that lists story ids. Select a story by its file and export instead: \`stories: [{ "absoluteStoryPath": "/abs/path/Button.stories.tsx", "exportName": "Primary" }]\`.`;
  }
  const several = commands.length > 1;
  const guidance = [
    inputs.moduleGraphSupported &&
      `${v.Run} ${changed} after your last edit and before every review, also when you already know the ids of the stories you wrote: it adds the stories of other components that your change affects. The list covers your edits so far, so checks in between, such as a type check, need no new call.`,
    `Story ids come only from the ${v.output} of ${several ? `these ${v.commands}` : `this ${v.command}`}, so wait for it before you use an id. Never build one yourself from a file name, an export name, a title or memory.`,
    inputs.moduleGraphSupported &&
      `When ${changed} leaves out a file you touched, pass that file to ${findByComponent}, or for a shared file (design token, theme, util, hook), which has no stories of its own, the components that use it. When ${findByComponent} reports stories hidden by \`maxDistance\`, ${v.cli ? 'rerun it' : 'call it again'} with a higher ${v.flag('maxDistance')}.`,
    `When ${several ? 'none of them finds' : 'it does not find'} a story for a component, it has no stories yet: say so, or write them.`,
  ]
    .filter(Boolean)
    .join(' ');
  const list = v.cli
    ? `\`\`\`sh
${commands.join('\n')}
\`\`\``
    : commands.join('\n');
  return `## Find the stories

${list}

${guidance}`;
}

const REVIEW_EXAMPLE = `{
  "title": "Rounder buttons",
  "description": "The **Button** corner radius goes from 4px to 8px.",
  "collections": [
    { "title": "Button variants", "rationale": "The component that changed.", "storyIds": ["button--primary", "button--disabled"] },
    { "title": "Forms that use it", "rationale": "Where the change shows up in context.", "storyIds": ["login-form--default"] }
  ],
  "changedFiles": ["src/Button.tsx"]
}`;

function reviewSection(
  v: SkillVocabulary,
  { moduleGraphSupported }: UiWorkflowSkillInputs
): string {
  const discoverFirst = moduleGraphSupported
    ? ` When you changed files, take the story ids from ${v.name('stories.changed')}, ${v.cli ? 'run' : 'called'} after your last edit (and from ${v.name('stories.findByComponent')} only for a file it leaves out), also when you only wrote stories; never take them from the test ${v.output}.`
    : '';
  const command = v.cli
    ? `\`\`\`sh
${v.ref('review.create')} --input '${REVIEW_EXAMPLE}'
\`\`\``
    : `Call ${v.name('review.create')} with:

\`\`\`json
${REVIEW_EXAMPLE}
\`\`\``;
  return `## Finish with a review

${command}

Publish a review after every change the user can see, and again after each later change.${v.cli ? ' It needs a running Storybook.' : ''}${discoverFirst} Group the stories into two to five collections, from the changed component up to the pages that show it (one is enough when a single component is affected), and include every story you created. List every file you created or changed in \`changedFiles\`, story files too. When the user only asks to see or browse components or stories and you changed no files, publish the same review with \`"changedFiles": []\`. Skip the review only when nothing visible changed, such as a change to a callback, tests or types, and the user did not ask to see anything, and say that instead.

Publish it as your last step, after your other checks such as a type check, lint or \`git status\`. Right before it, get your in-app browser ready if you have one: load its tool, or read its skill and run the setup code it gives, so the page opens with one call afterwards. Then do both things ${v.cli ? 'the command prints' : 'its result tells you'}, every time: open the review in that browser (unless you have none), and end your answer with the three lines of the review section it gives you, unchanged: heading, text line and 👉 link. Do not list separate story links next to it or repeat the review link elsewhere in your answer.`;
}

function previewSection(v: SkillVocabulary): string {
  const command = v.cli
    ? `\`\`\`sh
${v.ref('stories.preview')} --stories '[{"storyId":"<id>"}]'   # direct links to stories
\`\`\``
    : `- ${v.name('stories.preview')} with \`stories: [{ "storyId": "<id>" }]\`: direct links to stories`;
  return `## Link to one story

${command}

Only for a look at one story while you iterate, or when the user asks for a direct link. It does not replace the review, unless ${v.name('review.create')} keeps failing after you fixed what it reported: then share these links and say why.`;
}

function docsSection(transport: SkillTextTransport): string {
  return `## Look up components first

${componentLookup(transport)}`;
}

export function buildUiWorkflowSkill(inputs: UiWorkflowSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  const nextSteps = v.cli
    ? 'Some commands print what to do next; follow that too. Add \`--help\` to a command only when a call fails.'
    : `${MCP_TOOLS_NOTE} Some tools return what to do next; follow that too.`;
  return [
    `# Storybook UI workflow

Follow this for every change to how the UI looks (components, stories, styles, themes, tokens) and for requests to show components or stories. When the project's agent instructions (such as \`AGENTS.md\`) describe this workflow without some of its steps, for example without the review, skip those steps, but always look up the components first. ${nextSteps}`,
    inputs.docsEnabled && docsSection(inputs.transport),
    writeSection(inputs),
    discoverSection(v, inputs),
    inputs.testSupported && testSection(v, inputs.a11yEnabled),
    reviewSection(v, inputs),
    previewSection(v),
  ]
    .filter(Boolean)
    .join('\n\n');
}
