import { getToolName } from '../../../shared/open-service/toolset-names.ts';

export type ComponentDocsSkillInputs = {
  docsEnabled: boolean;
};

const ref = getToolName({ transport: 'cli' });

const next =
  "When the project's agent instructions (such as `AGENTS.md`) also name the `ui-workflow` skill, invoke it next for a UI change: it writes the stories, runs the tests and publishes the review.";

export function buildComponentDocsSkill({ docsEnabled }: ComponentDocsSkillInputs): string {
  if (!docsEnabled) {
    return `# Storybook component docs

This Storybook has no components manifest, so \`storybook tools docs\` is unavailable. Find the components to reuse in the source files instead, and read their props from the code.

${next}`;
  }
  return `# Storybook component docs

\`\`\`sh
${ref('docs.list')}             # every component and docs page, with its id
${ref('docs.show')} --id <id>   # props and usage examples of one entry
${ref('docs.showStory')} --storyId <id>   # the code of a story that docs show only lists
\`\`\`

Do this before you edit any file that changes the UI: run \`docs list\` once, then \`docs show\` for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Reuse what exists instead of building a duplicate. Use only the props that \`docs show\` documents, never one you assume from a name or another library, and answer props, API and usage questions from these commands. Read source files or \`node_modules\` only when the commands return nothing relevant. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry to both commands that show it: \`--storybookId acme\`.

${next}`;
}
