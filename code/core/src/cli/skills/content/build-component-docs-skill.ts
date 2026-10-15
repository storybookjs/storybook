import { type SkillTextTransport, skillVocabulary } from './skill-vocabulary.ts';

// The MCP server's toolsets can be switched off, which the skills CLI cannot see.
export const MCP_TOOLS_NOTE =
  'The tools named here are the tools of the Storybook MCP server; skip a step whose tool the server does not list.';

/**
 * How to look up the components to reuse. `ui-workflow` inlines it, so an agent cannot skip the
 * lookup by not invoking `component-docs`. With `--mcp`, both skills render it with the MCP tool
 * names.
 */
export function componentLookup(transport: SkillTextTransport = 'cli'): string {
  const v = skillVocabulary(transport);
  const list = v.name('docs.list');
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
  return `${tools}

Do this before you edit any file: ${v.run} ${list} once and read its ${v.output}, then ${v.run} ${show} with an id from that ${v.output} for every listed component your change uses, even one you only add such as a button, and for each one you are asked about. Never guess an id. Reuse what exists instead of building a duplicate. Use only the props that ${show} documents, never one you assume from a name or another library. ${v.Run} ${show} ${oncePerId}: the props often come after long story examples. Answer props, API and usage questions from these ${v.commands}. Read source files or \`node_modules\` only when the ${v.commands} return nothing relevant. When ${list} groups its entries under sources (\`id: acme\`), pass the source of the entry ${sources}.`;
}

export function buildComponentDocsSkill(transport: SkillTextTransport = 'cli'): string {
  const uiWorkflow =
    transport === 'cli'
      ? "the `ui-workflow` skill when the project's agent instructions (such as `AGENTS.md`) name it"
      : "`npx storybook skills ui-workflow --mcp` when your agent instructions or the Storybook MCP server's instructions name it";
  return `# Storybook component docs

${transport === 'mcp' ? `${MCP_TOOLS_NOTE}\n\n` : ''}${componentLookup(transport)}

For a change to the UI, use ${uiWorkflow}: it includes this lookup, then writes the stories, runs the tests and publishes the review.`;
}
