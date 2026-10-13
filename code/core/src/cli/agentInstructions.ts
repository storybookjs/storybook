import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The section that tells agents when to use the Storybook skills. The skills themselves no longer
 * claim every UI change, so this section is what makes agents use them; users edit it to change
 * when, or delete it to opt out.
 */
export const STORYBOOK_AGENT_INSTRUCTIONS = `## Storybook

When you change the UI, or the user asks to see components or stories, use both Storybook skills, in this order:

1. \`component-docs\`: look up the components to reuse, before you edit any file.
2. \`ui-workflow\`: update your stories, run the tests, and publish a review of the results.
`;

// Claude Code reads AGENTS.md only when the project has no CLAUDE.md of its own, so a CLAUDE.md
// that does not import AGENTS.md gets the section as well.
const CLAUDE_FILES = ['CLAUDE.md', '.claude/CLAUDE.md'];
const IMPORTS_AGENTS_MD = /(^|\s)@(\.\/)?AGENTS\.md\b/m;

/**
 * Plans {@link addStorybookAgentInstructions} over any file system: the new content of each file
 * to write, keyed by its path relative to the project root. `read` resolves to `undefined` for a
 * file that does not exist.
 */
export async function planStorybookAgentInstructions(
  read: (file: string) => Promise<string | undefined>
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const append = (file: string, content: string | undefined) => {
    // A file that already names the skill keeps its own, possibly customized, instructions.
    if (!content?.includes('`ui-workflow`')) {
      files[file] = content?.trim()
        ? `${content.trimEnd()}\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`
        : STORYBOOK_AGENT_INSTRUCTIONS;
    }
  };

  append('AGENTS.md', await read('AGENTS.md'));
  for (const file of CLAUDE_FILES) {
    const content = await read(file);
    if (content !== undefined && !IMPORTS_AGENTS_MD.test(content)) {
      append(file, content);
    }
  }
  return files;
}

/**
 * Adds {@link STORYBOOK_AGENT_INSTRUCTIONS} to the `AGENTS.md` in `root`, creating it when missing,
 * and to an existing `CLAUDE.md` that does not import `AGENTS.md`. A file that already names the
 * `ui-workflow` skill is left alone, so customized instructions survive.
 *
 * @returns The files it wrote, relative to `root`.
 */
export async function addStorybookAgentInstructions(root: string): Promise<string[]> {
  const files = await planStorybookAgentInstructions(async (file) => {
    try {
      return await readFile(join(root, file), 'utf8');
    } catch {
      return undefined;
    }
  });
  for (const [file, content] of Object.entries(files)) {
    await writeFile(join(root, file), content);
  }
  return Object.keys(files);
}
