import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'pathe';

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

// One block, from a BEGIN marker on its own line to the next END marker on its own line, with the
// line break after it. A marker mentioned in prose does not match, and a second BEGIN ends the
// search, so a block that lost its END marker cannot swallow the text after it.
const SECTION = new RegExp(
  `^${BEGIN_MARKER}[ \\t]*\\r?\\n(?:(?!^${BEGIN_MARKER})[\\s\\S])*?^${END_MARKER}[ \\t]*(?:\\r?\\n)?`,
  'm'
);

// Claude Code reads AGENTS.md only when the project has none of these files, and resolves an
// import relative to the file that has it. CLAUDE.local.md is personal, so it comes last.
const CLAUDE_FILES = [
  { file: 'CLAUDE.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
  { file: '.claude/CLAUDE.md', importsAgentsMd: /(^|\s)@\.\.\/AGENTS\.md\b/m },
  { file: 'CLAUDE.local.md', importsAgentsMd: /(^|\s)@(\.\/)?AGENTS\.md\b/m },
];

// Also matches a section the user customized, so it is not added a second time.
const NAMES_A_STORYBOOK_SKILL = /\b(ui-workflow|component-docs)\b/;

// The block between the markers, when the file has one.
const findSection = (content: string | undefined): string | undefined =>
  content === undefined ? undefined : SECTION.exec(content)?.[0];

/**
 * `install` adds the section to a file that lacks it; `update` only replaces an outdated section
 * between the markers, so a removed section stays removed and a file without markers stays as the
 * user wrote it.
 */
export type AgentInstructionsMode = 'install' | 'update';

// The section in the line endings of the file it goes into, so a CRLF file stays CRLF and an
// update of an unchanged section is a no-op there too.
const sectionFor = (content: string | undefined) =>
  content?.includes('\r\n')
    ? STORYBOOK_AGENT_INSTRUCTIONS.replaceAll('\n', '\r\n')
    : STORYBOOK_AGENT_INSTRUCTIONS;

// The new content of the file, or `undefined` when it needs no change.
function withSection(content: string | undefined, mode: AgentInstructionsMode): string | undefined {
  const section = sectionFor(content);
  if (content !== undefined && findSection(content) !== undefined) {
    const updated = content.replace(SECTION, () => section);
    return updated === content ? undefined : updated;
  }
  if (mode === 'update' || NAMES_A_STORYBOOK_SKILL.test(content ?? '')) {
    return undefined;
  }
  const eol = content?.includes('\r\n') ? '\r\n' : '\n';
  return content?.trim() ? `${content.trimEnd()}${eol}${eol}${section}` : section;
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
      claudeFiles.push({ file, content, importsAgentsMd, section: findSection(content) });
    }
  }
  const withMarkers = claudeFiles.filter(({ section }) => section !== undefined);
  for (const { file, content, importsAgentsMd, section } of withMarkers) {
    // A user who replaced the copy with an import of AGENTS.md keeps it (the case nrwl/nx#37181
    // reports Nx gets wrong).
    if (importsAgentsMd.test(section ?? '')) {
      continue;
    }
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
    changes.push({
      file,
      change: findSection(existing.get(file)) !== undefined ? 'updated' : 'added',
    });
  }
  return changes;
}
