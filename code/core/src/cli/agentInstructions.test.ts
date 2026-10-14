import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import {
  STORYBOOK_AGENT_INSTRUCTIONS,
  addStorybookAgentInstructions,
} from './agentInstructions.ts';

vi.mock('node:fs/promises', { spy: true });

const ROOT = '/test/project';
const read = (file: string) => vol.readFileSync(join(ROOT, file), 'utf8');

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(readFile).mockImplementation(memfs.fs.promises.readFile as unknown as typeof readFile);
  vi.mocked(writeFile).mockImplementation(
    memfs.fs.promises.writeFile as unknown as typeof writeFile
  );
  vol.reset();
  vol.mkdirSync(join(ROOT, '.claude'), { recursive: true });
});

describe('addStorybookAgentInstructions', () => {
  it('writes nothing when an existing file cannot be read', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n');
    vi.mocked(readFile).mockRejectedValueOnce(
      Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    );

    await expect(addStorybookAgentInstructions(ROOT)).rejects.toThrow('EACCES');
    expect(read('AGENTS.md')).toBe('# Rules\n');
  });

  it('creates AGENTS.md when the project has none', async () => {
    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md']);
    expect(read('AGENTS.md')).toBe(STORYBOOK_AGENT_INSTRUCTIONS);
  });

  it('appends the section to an existing AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n\nUse pnpm.\n\n');

    await addStorybookAgentInstructions(ROOT);

    expect(read('AGENTS.md')).toBe(`# Rules\n\nUse pnpm.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it.each([
    '## Storybook\n\n- `ui-workflow`: for UI changes. Follow it to update your stories and run the tests.\n',
    'Run /component-docs for questions about a component.\n',
  ])('leaves a file alone that already names a Storybook skill (%j)', async (custom) => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), custom);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([]);
    expect(read('AGENTS.md')).toBe(custom);
  });

  it('also adds the section to CLAUDE.md, which Claude Code reads instead of AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(read('CLAUDE.md')).toBe(`Be brief.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it('adds one copy for Claude Code when the project has both CLAUDE.md files', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), 'Be kind.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(read('.claude/CLAUDE.md')).toBe('Be kind.\n');
  });

  it('adds the section to .claude/CLAUDE.md when it is the only CLAUDE.md', async () => {
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), 'Be kind.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', '.claude/CLAUDE.md']);
  });

  it('adds the section to CLAUDE.local.md when it is the only file Claude Code reads', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.local.md'), 'Use my fork.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', 'CLAUDE.local.md']);
  });

  it('prefers the shared CLAUDE.md over the personal CLAUDE.local.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.local.md'), 'Use my fork.\n');
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(read('CLAUDE.local.md')).toBe('Use my fork.\n');
  });

  it.each([
    ['CLAUDE.md', '@AGENTS.md\n'],
    ['CLAUDE.md', 'Read these first: @./AGENTS.md\n'],
    ['.claude/CLAUDE.md', '@../AGENTS.md\n'],
    ['CLAUDE.local.md', '@AGENTS.md\n'],
  ])('writes no CLAUDE.md when %s imports AGENTS.md (%j)', async (file, content) => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, file), content);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md']);
  });

  it('does not count an import of .claude/AGENTS.md as an import of the root AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), '@AGENTS.md\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md', '.claude/CLAUDE.md']);
  });

  it('creates no CLAUDE.md', async () => {
    await addStorybookAgentInstructions(ROOT);

    expect(vol.existsSync(join(ROOT, 'CLAUDE.md'))).toBe(false);
  });
});
