import { getToolName } from '../../../shared/open-service/toolset-names.ts';

const ref = getToolName({ transport: 'cli' });

/**
 * How to look up the components to reuse. `ui-workflow` inlines it, so an agent cannot skip the
 * lookup by not invoking `component-docs`.
 */
export function componentLookup(): string {
  return `\`\`\`sh
${ref('docs.list')}             # every component and docs page, with its id
${ref('docs.show')} --id <id>   # props and usage examples of one entry
${ref('docs.showStory')} --storyId <id>   # the code of a story that docs show only lists
\`\`\`

Do this before you edit any file: run \`docs list\` once and read its output, then run \`docs show\` with an id from that output for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that \`docs show\` documents, never one you assume from a name or another library. Run it once per id, each in its own command, and read its whole output without \`head\` or \`tail\`: the props come last. Answer props, API and usage questions from these commands. Read source files or \`node_modules\` only when the commands return nothing relevant. When \`docs list\` groups its entries under sources (\`id: acme\`), pass the source of the entry to both commands that show it: \`--storybookId acme\`.`;
}

export function buildComponentDocsSkill(): string {
  return `# Storybook component docs

${componentLookup()}

For a change to the UI, use the \`ui-workflow\` skill when the project's agent instructions (such as \`AGENTS.md\`) name it: it includes this lookup, then writes the stories, runs the tests and publishes the review.`;
}
