import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The same marker convention as Next.js (`BEGIN:nextjs-agent-rules`) and Nx: Storybook owns the
// text between the markers and replaces it on upgrade, so a user who wants their own text removes
// the markers. The skills do not claim UI changes on their own: this section is what makes agents
// use them.
const BEGIN_MARKER = '<!-- BEGIN:storybook-skills -->';
const END_MARKER = '<!-- END:storybook-skills -->';

export const STORYBOOK_AGENT_INSTRUCTIONS = `${BEGIN_MARKER}
<!-- Storybook updates this section on upgrade. Remove both markers to keep your own edits. -->

## Storybook skills

For each of these tasks, invoke its Storybook skill first, before you edit any file, and follow it:

- \`ui-workflow\`: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results.
- \`component-docs\`: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. It lists the project's components with their props and usage examples.

${END_MARKER}
`;

const SECTION = new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\n?`);

// Claude Code reads AGENTS.md only when the project has none of these files, and resolves an
// import relative to the file that has it. CLAUDE.local.md is personal, so it comes last.
const CLAUDE_FILES = [
  { file: 'CLAUDE.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
  { file: '.claude/CLAUDE.md', importsAgentsMd: /(^|\s)@\.\.\/AGENTS\.md\b/m },
  { file: 'CLAUDE.local.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
];

// Also matches a section the user customized, so it is not added a second time.
const NAMES_A_STORYBOOK_SKILL = /\b(ui-workflow|component-docs)\b/;

/** Whether the file has the section between Storybook's markers, so an upgrade can update it. */
export const hasStorybookSection = (content: string | undefined): content is string =>
  content !== undefined && SECTION.test(content);

/**
 * `install` adds the section to a file that lacks it; `update` only replaces an outdated section
 * between the markers, so a removed section stays removed and a file without markers stays as the
 * user wrote it.
 */
export type AgentInstructionsMode = 'install' | 'update';

// The new content of the file, or `undefined` when it needs no change.
function withSection(content: string | undefined, mode: AgentInstructionsMode): string | undefined {
  if (hasStorybookSection(content)) {
    const updated = content.replace(SECTION, STORYBOOK_AGENT_INSTRUCTIONS);
    return updated === content ? undefined : updated;
  }
  if (mode === 'update' || NAMES_A_STORYBOOK_SKILL.test(content ?? '')) {
    return undefined;
  }
  return content?.trim()
    ? `${content.trimEnd()}\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`
    : STORYBOOK_AGENT_INSTRUCTIONS;
}

// The new content of each file to write, keyed by its path relative to the project root. `read`
// resolves to `undefined` for a file that does not exist.
export async function planStorybookAgentInstructions(
  read: (file: string) => Promise<string | undefined>,
  mode: AgentInstructionsMode = 'install'
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const agentsMd = withSection(await read('AGENTS.md'), mode);
  if (agentsMd !== undefined) {
    files['AGENTS.md'] = agentsMd;
  }

  const claudeFiles = [];
  for (const { file, importsAgentsMd } of CLAUDE_FILES) {
    const content = await read(file);
    if (content !== undefined) {
      claudeFiles.push({ file, content, importsAgentsMd });
    }
  }
  const withMarkers = claudeFiles.filter(({ content }) => hasStorybookSection(content));
  for (const { file, content } of withMarkers) {
    const updated = withSection(content, mode);
    if (updated !== undefined) {
      files[file] = updated;
    }
  }
  const claudeSeesSection =
    withMarkers.length > 0 ||
    claudeFiles.some(
      ({ content, importsAgentsMd }) =>
        importsAgentsMd.test(content) || NAMES_A_STORYBOOK_SKILL.test(content)
    );
  // Claude Code loads every CLAUDE.md, so one copy is enough.
  const [claudeFile] = claudeFiles;
  if (claudeFile && !claudeSeesSection) {
    const added = withSection(claudeFile.content, mode);
    if (added !== undefined) {
      files[claudeFile.file] = added;
    }
  }
  return files;
}

export type AgentInstructionsChange = { file: string; change: 'added' | 'updated' };

export async function addStorybookAgentInstructions(
  root: string,
  mode: AgentInstructionsMode = 'install'
): Promise<AgentInstructionsChange[]> {
  const existing = new Map<string, string | undefined>();
  const files = await planStorybookAgentInstructions(async (file) => {
    try {
      const content = await readFile(join(root, file), 'utf8');
      existing.set(file, content);
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }, mode);
  const changes: AgentInstructionsChange[] = [];
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(root, file), content);
    changes.push({ file, change: hasStorybookSection(existing.get(file)) ? 'updated' : 'added' });
  }
  return changes;
}
