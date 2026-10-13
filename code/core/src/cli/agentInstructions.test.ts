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
  it('creates AGENTS.md when the project has none', async () => {
    expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md']);
    expect(read('AGENTS.md')).toBe(STORYBOOK_AGENT_INSTRUCTIONS);
  });

  it('appends the section to an existing AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), '# Rules\n\nUse pnpm.\n\n');

    await addStorybookAgentInstructions(ROOT);

    expect(read('AGENTS.md')).toBe(`# Rules\n\nUse pnpm.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it('leaves a file alone that already names the ui-workflow skill, also when customized', async () => {
    const custom = '## Storybook\n\nUpdate stories and test with the `ui-workflow` skill.\n';
    vol.writeFileSync(join(ROOT, 'AGENTS.md'), custom);

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([]);
    expect(read('AGENTS.md')).toBe(custom);
  });

  it('also adds the section to a CLAUDE.md, which Claude Code reads instead of AGENTS.md', async () => {
    vol.writeFileSync(join(ROOT, 'CLAUDE.md'), 'Be brief.\n');
    vol.writeFileSync(join(ROOT, '.claude/CLAUDE.md'), 'Be kind.\n');

    expect(await addStorybookAgentInstructions(ROOT)).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
      '.claude/CLAUDE.md',
    ]);
    expect(read('CLAUDE.md')).toBe(`Be brief.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
    expect(read('.claude/CLAUDE.md')).toBe(`Be kind.\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it.each(['@AGENTS.md\n', 'Read these first: @./AGENTS.md\n'])(
    'skips a CLAUDE.md that imports AGENTS.md (%j)',
    async (claudeMd) => {
      vol.writeFileSync(join(ROOT, 'CLAUDE.md'), claudeMd);

      expect(await addStorybookAgentInstructions(ROOT)).toEqual(['AGENTS.md']);
      expect(read('CLAUDE.md')).toBe(claudeMd);
    }
  );

  it('creates no CLAUDE.md', async () => {
    await addStorybookAgentInstructions(ROOT);

    expect(vol.existsSync(join(ROOT, 'CLAUDE.md'))).toBe(false);
  });
});
