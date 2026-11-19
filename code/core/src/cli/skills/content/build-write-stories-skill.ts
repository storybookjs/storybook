import { ERROR_EXPORT_RULE, networkMockRule, USER_EVENT_RULE } from './story-rules.ts';

export type WriteStoriesSkillInputs = {
  framework: string;
  // The preview file uses `definePreview`, so story files use CSF Factories.
  csfFactories: boolean;
  // Relative to the working directory.
  previewFile: string;
  typescript: boolean;
};

// Names no command, so the CLI and the MCP rendering are the same text.
export function buildWriteStoriesSkill({
  framework,
  csfFactories,
  previewFile,
  typescript,
}: WriteStoriesSkillInputs): string {
  const format = csfFactories
    ? `This project writes stories with CSF Factories, because \`${previewFile}\` uses \`definePreview\`: \`import preview from '../.storybook/preview'\` (the path to that file), then \`const meta = preview.meta({ component: Button })\` and \`export const Primary = meta.story({ args: { ... } })\`. Do not import \`Meta\` or \`StoryObj\`. Import`
    : typescript
      ? `Import \`Meta\` and \`StoryObj\` from \`${framework}\` (in a new story file also when other stories import them from another package; a file you only edit keeps its imports), and`
      : 'Import';
  return `# Write the component and its stories

Every component you create or change gets stories: one per distinct state it can reach (variants, loading, empty, error, disabled), with realistic props. ${ERROR_EXPORT_RULE} An interactive component also gets a \`play\` function that drives it and asserts the visible result; for a callback passed as \`fn()\`, assert whether it was called, as that state expects. The rules below are for the stories you write; do not rewrite existing stories only to match them.

- ${format} \`fn\`, \`expect\`, \`mocked\` and \`sb\` from \`storybook/test\`.
- Leave \`title\` out of a new story file, so Storybook derives it from the file path.
- \`play: async ({ canvas, userEvent }) => { ... }\`: query \`canvas\` directly, by role or label. Never wrap it in \`within()\`. ${USER_EVENT_RULE}
- ${networkMockRule({ csfFactories, previewFile })}
- Mock a module only for a dependency that is not a network call: register it in \`${previewFile}\` with \`sb.mock(import('../src/api.${typescript ? 'ts' : 'js'}'), { spy: true })\` (path relative to that file, with its extension), then set the result per story in \`beforeEach\` with \`mocked(getUser).mockResolvedValue(...)\`.`;
}
