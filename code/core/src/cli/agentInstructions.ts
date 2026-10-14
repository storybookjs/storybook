import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The skills do not claim UI changes on their own: this section is what makes agents use them.
export const STORYBOOK_AGENT_INSTRUCTIONS = `## Storybook

For each of these tasks, invoke its Storybook skill first, before you edit any file, and follow it:

- \`ui-workflow\`: you create, change, or delete a component, story, style, theme, or design token, or otherwise change how the UI looks; you run or fix story tests; or the user asks to see components or stories. It looks up the components to reuse, updates your stories, runs the tests, and publishes a review of the results.
- \`component-docs\`: you look for an existing component to reuse instead of building a new one, or the user asks about a component's props, API, or usage. It lists the project's components with their props and usage examples.
`;

// Claude Code reads AGENTS.md only when the project has none of these files, and resolves an
// import relative to the file that has it. CLAUDE.local.md is personal, so it comes last.
const CLAUDE_FILES = [
  { file: 'CLAUDE.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
  { file: '.claude/CLAUDE.md', importsAgentsMd: /(^|\s)@\.\.\/AGENTS\.md\b/m },
  { file: 'CLAUDE.local.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
];

// Also matches a section the user customized, so it is not added a second time.
const NAMES_A_STORYBOOK_SKILL = /\b(ui-workflow|component-docs)\b/;

const withSection = (content: string | undefined) =>
  content?.trim()
    ? `${content.trimEnd()}\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`
    : STORYBOOK_AGENT_INSTRUCTIONS;

// The new content of each file to write, keyed by its path relative to the project root. `read`
// resolves to `undefined` for a file that does not exist.
export async function planStorybookAgentInstructions(
  read: (file: string) => Promise<string | undefined>
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const agentsMd = await read('AGENTS.md');
  if (!NAMES_A_STORYBOOK_SKILL.test(agentsMd ?? '')) {
    files['AGENTS.md'] = withSection(agentsMd);
  }

  const claudeFiles = [];
  for (const { file, importsAgentsMd } of CLAUDE_FILES) {
    const content = await read(file);
    if (content !== undefined) {
      claudeFiles.push({ file, content, importsAgentsMd });
    }
  }
  const claudeSeesSection = claudeFiles.some(
    ({ content, importsAgentsMd }) =>
      importsAgentsMd.test(content) || NAMES_A_STORYBOOK_SKILL.test(content)
  );
  // Claude Code loads every CLAUDE.md, so one copy is enough.
  const [claudeFile] = claudeFiles;
  if (claudeFile && !claudeSeesSection) {
    files[claudeFile.file] = withSection(claudeFile.content);
  }
  return files;
}

export async function addStorybookAgentInstructions(root: string): Promise<string[]> {
  const files = await planStorybookAgentInstructions(async (file) => {
    try {
      return await readFile(join(root, file), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  });
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(root, file), content);
  }
  return Object.keys(files);
}
