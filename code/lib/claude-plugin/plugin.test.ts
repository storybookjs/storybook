import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { x } from 'tinyexec';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageRoot, '../..');

type ClaudeMarketplaceJson = {
  plugins?: Array<{
    source?: string;
  }>;
};

async function isClaudeCliAvailable() {
  try {
    const result = await x('claude', ['--version'], { nodeOptions: { cwd: packageRoot } });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

const hasClaudeCli = await isClaudeCliAvailable();

function readMarketplace(path: string) {
  return JSON.parse(readFileSync(path, 'utf8')) as ClaudeMarketplaceJson;
}

function normalizeMarketplace(marketplace: ClaudeMarketplaceJson) {
  return {
    ...marketplace,
    plugins: marketplace.plugins?.map((plugin) => ({
      ...plugin,
      source: '<plugin-root>',
    })),
  };
}

// Claude Code silently drops a skill's description from the agent-visible
// skill listing when it exceeds a shared listing budget — the skill then shows
// as a bare name with no trigger text and agents stop invoking it (this broke
// the 806-browse-request eval on 2026-07-02). The budget shrinks as more
// skills/plugins are installed; ~384 UTF-8 bytes was the empirical cutoff in a
// minimal sandbox, so stay well below it to survive plugin-heavy environments.
const MAX_SKILL_DESCRIPTION_BYTES = 350;

function readSkillDescription(skillPath: string) {
  const skill = readFileSync(skillPath, 'utf8');
  const description = skill.match(/^description: (.*)$/m)?.[1];
  if (description === undefined) {
    throw new Error(`No description frontmatter found in ${skillPath}`);
  }
  return description;
}

describe('stories skill description', () => {
  it.each([
    resolve(packageRoot, 'skills/stories/SKILL.md'),
    resolve(repoRoot, 'packages/codex-plugin/plugins/storybook/skills/stories/SKILL.md'),
  ])('stays under the silent-drop listing budget: %s', (skillPath) => {
    const description = readSkillDescription(skillPath);
    expect(Buffer.byteLength(description, 'utf8')).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_BYTES);
  });

  it('keeps the claude and codex plugin descriptions identical', () => {
    expect(readSkillDescription(resolve(packageRoot, 'skills/stories/SKILL.md'))).toBe(
      readSkillDescription(
        resolve(repoRoot, 'packages/codex-plugin/plugins/storybook/skills/stories/SKILL.md')
      )
    );
  });
});

describe('Claude story skill launch guidance', () => {
  it('keeps Claude launch guidance scoped to preview tooling without shell interpolation', () => {
    const launchSkill = readFileSync(resolve(packageRoot, 'skills/stories/SKILL.md'), 'utf8');

    expect(launchSkill).toContain('autoPort: true');
    expect(launchSkill).toContain('preferred package manager');
    expect(launchSkill).toContain('existing `package.json` Storybook script');
    expect(launchSkill).toContain('preview_start');
    expect(launchSkill).not.toMatch(/(?:^|[^\w])--port\b|\$\{?PORT\}?|\$env:PORT|%PORT%/i);
    expect(launchSkill).not.toMatch(/runtimeArgs[\s\S]+storybook[\s\S]+dev/i);
    expect(launchSkill).not.toContain('--ci');
  });
});

describe('Storybook Claude plugin CLI validation', () => {
  it('keeps root and package-local marketplaces in sync', () => {
    const packageMarketplace = readMarketplace(
      resolve(packageRoot, '.claude-plugin/marketplace.json')
    );
    const rootMarketplace = readMarketplace(resolve(repoRoot, '.claude-plugin/marketplace.json'));

    expect(packageMarketplace.plugins?.[0]?.source).toBe('./');
    expect(rootMarketplace.plugins?.[0]?.source).toBe('./packages/claude-plugin');
    expect(normalizeMarketplace(rootMarketplace)).toEqual(normalizeMarketplace(packageMarketplace));
  });

  it.skipIf(!hasClaudeCli)(
    'passes claude plugin validate for marketplace and plugin manifests',
    async () => {
      const packageMarketplace = await x('claude', ['plugin', 'validate', '.'], {
        nodeOptions: { cwd: packageRoot },
      });
      const rootMarketplace = await x('claude', ['plugin', 'validate', '.'], {
        nodeOptions: { cwd: repoRoot },
      });
      const plugin = await x('claude', ['plugin', 'validate', '.claude-plugin/plugin.json'], {
        nodeOptions: { cwd: packageRoot },
      });

      expect(packageMarketplace.exitCode).toBe(0);
      expect(rootMarketplace.exitCode).toBe(0);
      expect(plugin.exitCode).toBe(0);
    }
  );
});
