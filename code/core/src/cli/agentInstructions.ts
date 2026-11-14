import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'pathe';

import { buildAgentInstructions } from './skills/content/build-workflow-instructions.ts';

// The same marker convention as Next.js (`BEGIN:nextjs-agent-rules`) and Nx: Storybook owns the
// text between the markers and replaces it on upgrade, so a user who wants their own text removes
// the markers. The section is the workflow that tells agents when to use each skill.
const BEGIN_MARKER = '<!-- BEGIN:storybook-skills -->';
const END_MARKER = '<!-- END:storybook-skills -->';

export type AgentInstructionsInputs = {
  /** A Storybook of the project has `@storybook/addon-vitest`, so the section has a test step. */
  testSupported: boolean;
};

export const storybookAgentInstructions = ({ testSupported }: AgentInstructionsInputs) =>
  `${BEGIN_MARKER}
<!-- Storybook updates this section on upgrade. Remove both markers to keep your own edits. -->

${buildAgentInstructions({ testSupported })}

${END_MARKER}
`;

export const STORYBOOK_AGENT_INSTRUCTIONS = storybookAgentInstructions({ testSupported: true });

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

// The test step of this section, or of the 11.0 prereleases, which named the `test-stories` skill.
const TEST_STEP = /storybook tools test run|`test-stories`/;

// Also matches a section the user customized, so it is not added a second time: one written by
// an 11.0 prerelease, which named every skill, or one that keeps only the test command.
const NAMES_A_STORYBOOK_SKILL =
  /\b(component-docs|write-stories|test-stories|ui-review)\b|\bstorybook tools test run\b/;

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
const sectionFor = (content: string | undefined, section: string) =>
  content?.includes('\r\n') ? section.replaceAll('\n', '\r\n') : section;

// The new content of the file, or `undefined` when it needs no change.
function withSection(
  content: string | undefined,
  mode: AgentInstructionsMode,
  storybookSection: string
): string | undefined {
  const section = sectionFor(content, storybookSection);
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
// resolves to `undefined` for a file that does not exist. `section` replaces the skills section,
// for example with the MCP server instructions in the MCP evals.
export async function planStorybookAgentInstructions(
  read: (file: string) => Promise<string | undefined>,
  mode: AgentInstructionsMode = 'install',
  section = STORYBOOK_AGENT_INSTRUCTIONS
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const agentsMd = withSection(await read('AGENTS.md'), mode, section);
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
  for (const { file, content, importsAgentsMd, section: current } of withMarkers) {
    // A user who replaced the copy with an import of AGENTS.md keeps it (the case nrwl/nx#37181
    // reports Nx gets wrong).
    if (importsAgentsMd.test(current ?? '')) {
      continue;
    }
    const updated = withSection(content, mode, section);
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
    const added = withSection(claudeFile.content, mode, section);
    if (added !== undefined) {
      files[claudeFile.file] = added;
    }
  }
  return files;
}

// Whether AGENTS.md or a CLAUDE.md file has Storybook's section, for skills that came from a plugin
// or by hand and so have no entry in `skills-lock.json`.
export async function hasStorybookAgentInstructions(root: string): Promise<boolean> {
  for (const file of ['AGENTS.md', ...CLAUDE_FILES.map(({ file }) => file)]) {
    const content = await readFile(join(root, file), 'utf8').catch(() => undefined);
    if (findSection(content) !== undefined) {
      return true;
    }
  }
  return false;
}

export type AgentInstructionsChange = { file: string; change: 'added' | 'updated' };

export async function addStorybookAgentInstructions(
  root: string,
  mode: AgentInstructionsMode = 'install',
  inputs: AgentInstructionsInputs = { testSupported: true }
): Promise<AgentInstructionsChange[]> {
  const existing = new Map<string, string | undefined>();
  const read = async (file: string) => {
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
  };
  // Every Storybook of a monorepo shares this file. An install for one without addon-vitest keeps
  // the test step another one put there; only an upgrade, which checks every Storybook, drops it.
  const testSupported =
    inputs.testSupported ||
    (mode === 'install' && TEST_STEP.test(findSection(await read('AGENTS.md')) ?? ''));
  const files = await planStorybookAgentInstructions(
    read,
    mode,
    storybookAgentInstructions({ testSupported })
  );
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
