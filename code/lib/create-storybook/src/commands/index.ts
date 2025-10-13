/**
 * Command classes for Storybook initialization workflow
 *
 * Each command represents a discrete step in the init process with clear responsibilities
 */

export { executePreflightCheck } from './PreflightCheckCommand';
export type { PreflightCheckResult } from './PreflightCheckCommand';

export { executeUserPreferences } from './UserPreferencesCommand';
export type {
  InstallType,
  UserPreferencesOptions,
  UserPreferencesResult,
} from './UserPreferencesCommand';

export { executeProjectDetection } from './ProjectDetectionCommand';

export { executeGeneratorExecution } from './GeneratorExecutionCommand';
export type { GeneratorExecutionResult } from './GeneratorExecutionCommand';

export { executeAddonConfiguration } from './AddonConfigurationCommand';

export { executeDependencyInstallation } from './DependencyInstallationCommand';

export { executeFinalization } from './FinalizationCommand';
