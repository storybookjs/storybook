import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

export type ComponentDocsSkillInputs = {
  transport: SkillTextTransport;
  // Storybook has component manifests for this project, or composes a Storybook that has them.
  docsSupported: boolean;
  // `main.ts` turns the `docs` toolset of the MCP server off. Never for the CLI.
  toolsetOff?: boolean;
};

export function buildComponentDocsSkill(inputs: ComponentDocsSkillInputs): string {
  const v = skillVocabulary(inputs.transport);
  if (!inputs.docsSupported) {
    return `# Storybook component docs

This Storybook has no component docs to look up. Skip this step, and read the source files of the components you use instead.`;
  }
  const list = v.name('docs.list');
  // A client can turn the toolset on for itself with a request header, which this text cannot see.
  const toolsetOff = inputs.toolsetOff
    ? `\n\nThe \`main.ts\` of this project turns the \`docs\` toolset of the Storybook MCP server off. When the server does not give you ${list}, skip this step.`
    : '';
  const show = v.name('docs.show');
  const tools = v.cli
    ? `\`\`\`sh
${v.ref('docs.list')}             # every component and docs page, with its id
${v.ref('docs.show')} --id <id>   # props and usage examples of one entry
${v.ref('docs.showStory')} --storyId <id>   # the code of a story that docs show only lists
\`\`\``
    : `- ${list}: every component and docs page, with its id
- ${show} with an \`id\`: props and usage examples of one entry
- ${v.name('docs.showStory')} with a \`storyId\`: the code of a story that ${show} only lists`;
  const oncePerId = v.cli
    ? `once per id, each in its own command, and read its whole output without \`head\` or \`tail\``
    : 'once per id and read its whole result';
  const sources = v.cli
    ? 'to both commands that show it: `--storybookId acme`'
    : `as \`storybookId: "acme"\` to ${show} and ${v.name('docs.showStory')}`;
  return `# Storybook component docs

${v.notes}${toolsetOff}

${tools}

Do this before you edit any file: ${v.run} ${list} once and read its ${v.output}, then ${v.run} ${show} with an id from that ${v.output} for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that ${show} documents, never one you assume from a name or another library. ${v.Run} ${show} ${oncePerId}: the props often come after long story examples. Answer props, API and usage questions from these ${v.commands}. Read source files or \`node_modules\` only when the ${v.commands} return nothing relevant. When ${list} groups its entries under sources (\`id: acme\`), pass the source of the entry ${sources}.`;
}
