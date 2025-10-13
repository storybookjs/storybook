import type { NpmOptions } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import type { DependencyCollector } from '../dependency-collector';

/** Service for managing package operations during Storybook initialization */
export class PackageManagerService {
  private packageManager: JsPackageManager;

  constructor(packageManager: JsPackageManager) {
    this.packageManager = packageManager;
  }

  /** Get the package manager instance */
  getPackageManager(): JsPackageManager {
    return this.packageManager;
  }

  /** Install dependencies using the package manager */
  async installDependencies(): Promise<void> {
    await this.packageManager.installDependencies();
  }

  /** Add Storybook scripts to package.json */
  addStorybookScripts(port: number = 6006): void {
    this.packageManager.addStorybookCommandInScripts({ port });
  }

  /** Add custom scripts to package.json */
  addScripts(scripts: Record<string, string>): void {
    this.packageManager.addScripts(scripts);
  }

  /** Get versioned packages */
  async getVersionedPackages(packageNames: string[]): Promise<string[]> {
    return this.packageManager.getVersionedPackages(packageNames);
  }

  /** Get installed version of a package */
  async getInstalledVersion(packageName: string): Promise<string | null> {
    return this.packageManager.getInstalledVersion(packageName);
  }

  /** Get dependency version from package.json */
  getDependencyVersion(packageName: string): string | null {
    return this.packageManager.getDependencyVersion(packageName);
  }

  /** Get all dependencies (dependencies + devDependencies) */
  getAllDependencies(): Record<string, string> {
    return this.packageManager.getAllDependencies();
  }

  /** Install packages using dependency collector */
  async installCollectedDependencies(
    dependencyCollector: DependencyCollector,
    skipInstall: boolean = false
  ): Promise<void> {
    const { dependencies, devDependencies } = dependencyCollector.getAllPackages();

    if (dependencies.length > 0) {
      await this.packageManager.addDependencies(
        { type: 'dependencies', skipInstall: true },
        dependencies
      );
    }

    if (devDependencies.length > 0) {
      await this.packageManager.addDependencies(
        { type: 'devDependencies', skipInstall: true },
        devDependencies
      );
    }

    if (!skipInstall && dependencyCollector.hasPackages()) {
      await this.installDependencies();
    }
  }

  /** Add dependencies to package.json */
  async addDependencies(npmOptions: NpmOptions, packageNames: string[]): Promise<void> {
    await this.packageManager.addDependencies(npmOptions, packageNames);
  }

  /** Run a package command */
  async runPackageCommand(command: string, args: string[]): Promise<void> {
    await this.packageManager.runPackageCommand(command, args);
  }

  /** Get the run command for a script */
  getRunCommand(scriptName: string): string {
    return this.packageManager.getRunCommand(scriptName);
  }

  /** Get the package manager type */
  getType(): string {
    return this.packageManager.type;
  }

  /** Check if Storybook is in a monorepo */
  isStorybookInMonorepo(): boolean {
    return this.packageManager.isStorybookInMonorepo();
  }

  /** Get the latest version of a package */
  async latestVersion(packageName: string): Promise<string | null> {
    return this.packageManager.latestVersion(packageName);
  }
}
