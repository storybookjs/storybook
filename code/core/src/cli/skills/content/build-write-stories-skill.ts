import {
  errorExportRule,
  networkMockRule,
  type StoryFormatInputs,
  USER_EVENT_RULE,
} from './story-rules.ts';

export type WriteStoriesSkillInputs = StoryFormatInputs & {
  framework: string;
  typescript: boolean;
};

// The sentence on the story format, which ends in the `Import` of the `storybook/test` rule.
function formatRule({
  framework,
  csfFactories,
  previewFile,
  svelteCsf,
  typescript,
}: WriteStoriesSkillInputs): string {
  if (svelteCsf) {
    const script = typescript ? '<script module lang="ts">' : '<script module>';
    const meta = csfFactories
      ? `Because \`${previewFile}\` uses \`definePreview\`, the \`${script}\` of a story file has \`import preview from '../.storybook/preview'\` (the path to that file) and \`const { Story } = preview.meta({ component: Button })\`.`
      : `The \`${script}\` of a story file has \`import { defineMeta } from '${framework}'\` and \`const { Story } = defineMeta({ component: Button })\`.`;
    return `This project writes stories in Svelte CSF: a new story file is a \`.stories.svelte\` file, never a \`.stories.ts\` or \`.stories.js\` file, and has no \`export const\` stories. ${meta} Each story is a \`<Story name="Primary" args={{ ... }} />\` element; every other story property, such as \`play\`, \`beforeEach\`, \`parameters\` and \`tags\`, is a prop of it, and the description of a story is an HTML comment right above its \`<Story>\`. Import`;
  }
  if (csfFactories) {
    return `This project writes stories with CSF Factories, because \`${previewFile}\` uses \`definePreview\`: \`import preview from '../.storybook/preview'\` (the path to that file), then \`const meta = preview.meta({ component: Button })\` and \`export const Primary = meta.story({ args: { ... } })\`. Do not import \`Meta\` or \`StoryObj\`. Import`;
  }
  return typescript
    ? `Import \`Meta\` and \`StoryObj\` from \`${framework}\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and`
    : 'Import';
}

// Names no command, so the CLI and the MCP rendering are the same text.
export function buildWriteStoriesSkill(inputs: WriteStoriesSkillInputs): string {
  const { csfFactories, previewFile, svelteCsf, typescript } = inputs;
  return `# Write the component and its stories

Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. ${errorExportRule(svelteCsf)} An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

- ${formatRule(inputs)} \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
- Leave \`title\` out of a new story file, so Storybook derives it from the file path.
- ${svelteCsf ? '`play={async ({ canvas, userEvent }) => { ... }}`' : '`play: async ({ canvas, userEvent }) => { ... }`'}: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. ${USER_EVENT_RULE}
- ${networkMockRule({ csfFactories, previewFile, svelteCsf })}
- Mock a module only for a dependency that is not a network call: register it in \`${previewFile}\` with \`sb.mock(import('../src/api.${typescript ? 'ts' : 'js'}'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.`;
}
