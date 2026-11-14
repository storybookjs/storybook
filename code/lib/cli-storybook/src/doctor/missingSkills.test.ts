import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasStorybookSkills } from 'storybook/internal/cli';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { getMissingSkillsMessage } from './missingSkills.ts';

vi.mock('storybook/internal/cli', { spy: true });

const config = (framework: string) => ({ stories: [], framework }) as StorybookConfigRaw;

describe('getMissingSkillsMessage', () => {
  beforeEach(() => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(false);
  });

  it.each(['11.0.0', '11.0.0-beta.2', '12.1.0'])(
    'says how to add the skills on Storybook %s',
    async (version) => {
      await expect(getMissingSkillsMessage(config('@storybook/react-vite'), version)).resolves.toBe(
        'This project has no Storybook skills for AI agents. Add them with: npx storybook automigrate skills --yes'
      );
    }
  );

  it('says nothing when the project has the skills', async () => {
    vi.mocked(hasStorybookSkills).mockResolvedValue(true);

    await expect(
      getMissingSkillsMessage(config('@storybook/react-vite'), '11.0.0')
    ).resolves.toBeUndefined();
  });

  it.each([
    ['Storybook 10, which has no skills', '@storybook/react-vite', '10.6.7'],
    ['a framework without skills', '@storybook/html-vite', '11.0.0'],
    ['an unknown version', '@storybook/react-vite', undefined],
  ])('says nothing on %s', async (_, framework, version) => {
    await expect(getMissingSkillsMessage(config(framework), version)).resolves.toBeUndefined();
  });

  it('says nothing without a main config', async () => {
    await expect(getMissingSkillsMessage(undefined, '11.0.0')).resolves.toBeUndefined();
  });
});
