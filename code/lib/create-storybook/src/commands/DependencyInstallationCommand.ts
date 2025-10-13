import type { DependencyCollector } from '../dependency-collector';
import type { PackageManagerService } from '../services/PackageManagerService';

/**
 * Command for installing all collected dependencies
 *
 * Responsibilities:
 *
 * - Update package.json with all dependencies
 * - Run single installation operation
 * - Handle skipInstall option
 */
export class DependencyInstallationCommand {
  /** Execute dependency installation */
  async execute(
    packageManagerService: PackageManagerService,
    dependencyCollector: DependencyCollector,
    skipInstall: boolean = false
  ): Promise<void> {
    if (!dependencyCollector.hasPackages() && skipInstall) {
      return;
    }

    try {
      await packageManagerService.installCollectedDependencies(dependencyCollector, skipInstall);
    } catch (err) {
      throw err;
    }
  }
}
