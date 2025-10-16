import fs from 'node:fs/promises';

import type { ProjectType } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';
import { CLI_COLORS, logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dedent } from 'ts-dedent';

import type { GeneratorFeature } from '../generators/types';

/**
 * Command for finalizing Storybook installation
 *
 * Responsibilities:
 *
 * - Update .gitignore with Storybook entries
 * - Print success message
 * - Display feature summary
 * - Show next steps
 */
export class FinalizationCommand {
  /** Execute finalization steps */
  async execute(
    projectType: ProjectType,
    selectedFeatures: Set<GeneratorFeature>,
    storybookCommand: string
  ): Promise<void> {
    // Update .gitignore
    await this.updateGitignore();

    // Print success message
    this.printSuccessMessage(selectedFeatures, storybookCommand);
  }

  /** Update .gitignore with Storybook-specific entries */
  private async updateGitignore(): Promise<void> {
    const foundGitIgnoreFile = find.up('.gitignore');
    const rootDirectory = getProjectRoot();

    if (!foundGitIgnoreFile || !foundGitIgnoreFile.includes(rootDirectory)) {
      return;
    }

    const contents = await fs.readFile(foundGitIgnoreFile, 'utf-8');
    const hasStorybookLog = contents.includes('*storybook.log');
    const hasStorybookStatic = contents.includes('storybook-static');

    const linesToAdd = [
      !hasStorybookLog ? '*storybook.log' : '',
      !hasStorybookStatic ? 'storybook-static' : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (linesToAdd) {
      await fs.appendFile(foundGitIgnoreFile, `\n${linesToAdd}\n`);
    }
  }

  /** Print success message with feature summary */
  private printSuccessMessage(
    selectedFeatures: Set<GeneratorFeature>,
    storybookCommand: string
  ): void {
    const printFeatures = (features: Set<GeneratorFeature>) =>
      Array.from(features).join(', ') || 'none';

    logger.step(CLI_COLORS.success('Storybook was successfully installed in your project!'));

    logger.log(
      dedent`
        Additional features: ${printFeatures(selectedFeatures)}

        To run Storybook manually, run ${CLI_COLORS.cta(storybookCommand)}. CTRL+C to stop.

        Wanna know more about Storybook? Check out ${CLI_COLORS.cta('https://storybook.js.org/')}
        Having trouble or want to chat? Join us at ${CLI_COLORS.cta('https://discord.gg/storybook/')}
      `
    );

    logger.outro('');
  }
}

export const executeFinalization = (
  projectType: ProjectType,
  selectedFeatures: Set<GeneratorFeature>,
  storybookCommand: string
) => {
  return new FinalizationCommand().execute(projectType, selectedFeatures, storybookCommand);
};
