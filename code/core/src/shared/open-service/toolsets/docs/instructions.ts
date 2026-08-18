import { getToolName } from '../../toolset-names.ts';
import type { ToolsetCtx } from '../../toolset-definition.ts';

/**
 * Server-level guidance for the docs tools, rendered per transport.
 *
 * This is the workflow an agent should follow across the three tools, which no single tool
 * description can state: discover ids first, then fetch, and never invent a prop. It lives with the
 * toolset so both MCP surfaces serve the same text, and names its tools through {@link getToolName} so the
 * prose cannot drift from what is registered.
 */
export function getDocsToolsetInstructions(transport: ToolsetCtx['transport']): string {
  const ref = getToolName({ transport });
  return `## Documentation Workflow

**CRITICAL: Never hallucinate component properties!** Before using ANY property on a component (even common-sounding ones like \`shadow\`), you MUST verify it is documented via these tools. If it is not documented, it does not exist — never assume props from naming conventions or other libraries; report it to the user instead.

1. Call **${ref('docs.list')}** once at the start of the task to discover available component and docs IDs.
2. Call **${ref('docs.show')}** with an \`id\` from that list to retrieve full component docs, props, usage examples, and stories.
3. Call **${ref('docs.showStory')}** for extra docs on a story variant not covered by the component docs.

Only use properties explicitly documented or shown in example stories. Only reference IDs returned by these tools; never guess IDs.

## Multi-Source Requests

- With multiple sources configured, **${ref('docs.list')}** returns entries from every source; pass \`storybookId\` to **${ref('docs.show')}** to scope one.
`;
}

export const DOCS_TOOLSET_INSTRUCTIONS = getDocsToolsetInstructions('mcp');
