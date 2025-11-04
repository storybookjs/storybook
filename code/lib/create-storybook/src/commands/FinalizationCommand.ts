import fs from 'node:fs/promises';

import type { ProjectType } from 'storybook/internal/cli';
import { getProjectRoot } from 'storybook/internal/common';
import { CLI_COLORS, logTracker, logger } from 'storybook/internal/node-logger';
import { ErrorCollector } from 'storybook/internal/telemetry';
import type { Feature } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { dedent } from 'ts-dedent';

type ExecuteFinalizationParams = {
  projectType: ProjectType;
  selectedFeatures: Set<Feature>;
  storybookCommand?: string;
};

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
  async execute({ selectedFeatures, storybookCommand }: ExecuteFinalizationParams): Promise<void> {
    // Update .gitignore
    await this.updateGitignore();

    const errors = ErrorCollector.getErrors();

    if (errors.length > 0) {
      await this.printFailureMessage(selectedFeatures, storybookCommand);
    } else {
      this.printSuccessMessage(selectedFeatures, storybookCommand);
    }
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

  private async printFailureMessage(
    selectedFeatures: Set<Feature>,
    storybookCommand?: string
  ): Promise<void> {
    logger.warn('Storybook setup completed, but some non-blocking errors occurred.');
    this.printNextSteps(selectedFeatures, storybookCommand);

    const logFile = await logTracker.writeToFile();
    logger.log(`Storybook debug logs can be found at: ${logFile}`);
  }

  /** Print success message with feature summary */
  private printSuccessMessage(selectedFeatures: Set<Feature>, storybookCommand?: string): void {
    logger.step(CLI_COLORS.success('Storybook was successfully installed in your project!'));
    this.printNextSteps(selectedFeatures, storybookCommand);
  }

  private printNextSteps(selectedFeatures: Set<Feature>, storybookCommand?: string): void {
    const printFeatures = (features: Set<Feature>) => Array.from(features).join(', ') || 'none';

    logger.log(`Additional features: ${printFeatures(selectedFeatures)}`);

    if (storybookCommand) {
      logger.log(
        `To run Storybook manually, run ${CLI_COLORS.cta(storybookCommand)}. CTRL+C to stop.`
      );
    }

    logger.log(dedent`
      Wanna know more about Storybook? Check out ${CLI_COLORS.cta('https://storybook.js.org/')}
      Having trouble or want to chat? Join us at ${CLI_COLORS.cta('https://discord.gg/storybook/')}
    `);
  }
}
export const executeFinalization = (params: ExecuteFinalizationParams) => {
  return new FinalizationCommand().execute(params);
};
