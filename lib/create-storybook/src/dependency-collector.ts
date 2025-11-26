export type DependencyType = 'dependencies' | 'devDependencies';

interface PackageInfo {
  name: string;
  version?: string;
}

export interface VersionConflict {
  packageName: string;
  existingVersion: string;
  newVersion: string;
  type: DependencyType;
}

/**
 * Collects all dependencies that need to be installed during the init process. This allows us to
 * gather all packages first and then install them in a single operation.
 */
export class DependencyCollector {
  private packages: Map<DependencyType, Map<string, string>> = new Map([
    ['dependencies', new Map()],
    ['devDependencies', new Map()],
  ]);

  /** Add development dependencies */
  addDevDependencies(packageNames: string[]): void {
    this.add('devDependencies', packageNames);
  }

  /** Add regular dependencies */
  addDependencies(packageNames: string[]): void {
    this.add('dependencies', packageNames);
  }

  /** Get all packages across all types */
  getAllPackages(): { dependencies: string[]; devDependencies: string[] } {
    return {
      dependencies: this.getDependencies(),
      devDependencies: this.getDevDependencies(),
    };
  }

  /** Check if collector has any packages */
  hasPackages(): boolean {
    return (
      this.packages.get('dependencies')!.size > 0 || this.packages.get('devDependencies')!.size > 0
    );
  }

  /** Get all version conflicts across all dependency types */
  getVersionConflicts(): VersionConflict[] {
    const conflicts: VersionConflict[] = [];

    for (const [type, typeMap] of this.packages.entries()) {
      const packageNames = new Map<string, string[]>();

      // Group packages by name to find conflicts
      typeMap.forEach((version, name) => {
        const versions = packageNames.get(name) || [];
        versions.push(version);
        packageNames.set(name, versions);
      });

      // Find packages with multiple versions
      packageNames.forEach((versions, name) => {
        if (versions.length > 1 && new Set(versions).size > 1) {
          conflicts.push({
            packageName: name,
            existingVersion: versions[0],
            newVersion: versions[versions.length - 1],
            type,
          });
        }
      });
    }

    return conflicts;
  }

  /** Merge dependencies from another collector */
  merge(other: DependencyCollector): void {
    const { dependencies, devDependencies } = other.getAllPackages();
    this.addDependencies(dependencies);
    this.addDevDependencies(devDependencies);
  }

  /** Validate that all packages have valid version specifiers */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [type, typeMap] of this.packages.entries()) {
      typeMap.forEach((version, name) => {
        if (!name || name.trim() === '') {
          errors.push(`Invalid package name in ${type}: empty or whitespace`);
        }

        if (version === '') {
          errors.push(`Package ${name} in ${type} has empty version`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /** Get count of packages by type */
  getPackageCount(type?: DependencyType): number {
    if (type) {
      return this.packages.get(type)!.size;
    }
    return this.packages.get('dependencies')!.size + this.packages.get('devDependencies')!.size;
  }

  /**
   * Add packages to the collector
   *
   * @param type - The dependency type (dependencies or devDependencies)
   * @param packageNames - Array of package names, optionally with version specifiers (e.g.,
   *   'react@18.0.0')
   */
  private add(type: DependencyType, packageNames: string[]): void {
    const typeMap = this.packages.get(type)!;

    for (const pkg of packageNames) {
      const { name, version } = this.parsePackage(pkg);

      // If package already exists, only update if new version is specified
      if (typeMap.has(name)) {
        if (version) {
          typeMap.set(name, version);
        }
      } else {
        typeMap.set(name, version || 'latest');
      }
    }
  }

  /** Get all packages with their versions for a specific type */
  private getPackages(type: DependencyType): string[] {
    const typeMap = this.packages.get(type)!;
    return Array.from(typeMap.entries()).map(([name, version]) =>
      version === 'latest' ? name : `${name}@${version}`
    );
  }

  /** Get all development dependencies */
  private getDevDependencies(): string[] {
    return this.getPackages('devDependencies');
  }

  /** Get all regular dependencies */
  private getDependencies(): string[] {
    return this.getPackages('dependencies');
  }

  /**
   * Parse a package string into name and version
   *
   * @param pkg - Package string (e.g., 'react@18.0.0' or 'react')
   */
  private parsePackage(pkg: string): PackageInfo {
    // Handle scoped packages like @storybook/react@1.0.0
    const scopedMatch = pkg.match(/^(@[^@]+\/[^@]+)(?:@(.+))?$/);
    if (scopedMatch) {
      return {
        name: scopedMatch[1],
        version: scopedMatch[2],
      };
    }

    // Handle regular packages like react@18.0.0
    const regularMatch = pkg.match(/^([^@]+)(?:@(.+))?$/);
    if (regularMatch) {
      return {
        name: regularMatch[1],
        version: regularMatch[2],
      };
    }

    return { name: pkg };
  }
}
