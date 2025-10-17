import type { Builder, SupportedLanguage } from 'storybook/internal/cli';
import { externalFrameworks } from 'storybook/internal/cli';
import { versions } from 'storybook/internal/common';
import type { SupportedFrameworks, SupportedRenderers } from 'storybook/internal/types';

import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

/** Result of framework details resolution */
export interface FrameworkDetails {
  type: 'framework' | 'renderer';
  packages: string[];
  builder?: string;
  frameworkPackagePath?: string;
  renderer?: string;
  rendererId: SupportedRenderers;
  frameworkPackage?: string;
}

/** Module for resolving package names and details for Storybook initialization */
export class PackageResolver {
  /** Get builder package details */
  getBuilderDetails(builder: string): string {
    const map = versions as Record<string, string>;

    if (map[builder]) {
      return builder;
    }

    const builderPackage = `@storybook/${builder}`;
    if (map[builderPackage]) {
      return builderPackage;
    }

    return builder;
  }

  /** Get external framework configuration */
  getExternalFramework(framework?: string) {
    return externalFrameworks.find(
      (exFramework) =>
        framework !== undefined &&
        (exFramework.name === framework ||
          exFramework.packageName === framework ||
          exFramework?.frameworks?.some?.((item) => item === framework))
    );
  }

  /** Get framework package name */
  getFrameworkPackage(framework: string | undefined, renderer: string, builder: string): string {
    const externalFramework = this.getExternalFramework(framework);
    const storybookBuilder = builder?.replace(/^@storybook\/builder-/, '');
    const storybookFramework = framework?.replace(/^@storybook\//, '');

    if (externalFramework === undefined) {
      const frameworkPackage = framework
        ? `@storybook/${storybookFramework}`
        : `@storybook/${renderer}-${storybookBuilder}`;

      if (versions[frameworkPackage as keyof typeof versions]) {
        return frameworkPackage;
      }

      throw new Error(
        dedent`
          Could not find framework package: ${frameworkPackage}.
          Make sure this package exists, and if it does, please file an issue as this might be a bug in Storybook.
        `
      );
    }

    return (
      externalFramework.frameworks?.find((item) =>
        item.match(new RegExp(`-${storybookBuilder}`))
      ) ?? externalFramework.packageName!
    );
  }

  /** Get renderer package name */
  getRendererPackage(framework: string | undefined, renderer: string): string {
    const externalFramework = this.getExternalFramework(framework);

    if (externalFramework !== undefined) {
      return externalFramework.renderer || externalFramework.packageName!;
    }

    return `@storybook/${renderer}`;
  }

  /** Apply getAbsolutePath wrapper for PnP/monorepo compatibility */
  applyGetAbsolutePathWrapper(packageName: string): string {
    return `%%getAbsolutePath('${packageName}')%%`;
  }

  /** Apply getAbsolutePath wrapper to addon (supports both string and object format) */
  applyAddonGetAbsolutePathWrapper(pkg: string | { name: string }): string | { name: string } {
    if (typeof pkg === 'string') {
      return this.applyGetAbsolutePathWrapper(pkg);
    }
    const obj = { ...pkg } as { name: string };
    obj.name = this.applyGetAbsolutePathWrapper(pkg.name);
    return obj;
  }

  /** Get complete framework details including packages and paths */
  getFrameworkDetails(
    renderer: SupportedRenderers,
    builder: Builder,
    pnp: boolean,
    language: SupportedLanguage,
    framework?: SupportedFrameworks,
    shouldApplyRequireWrapperOnPackageNames?: boolean
  ): FrameworkDetails {
    const frameworkPackage = this.getFrameworkPackage(framework, renderer, builder);
    invariant(frameworkPackage, 'Missing framework package.');

    const frameworkPackagePath = shouldApplyRequireWrapperOnPackageNames
      ? this.applyGetAbsolutePathWrapper(frameworkPackage)
      : frameworkPackage;

    const rendererPackage = this.getRendererPackage(framework, renderer) as string;
    const rendererPackagePath = shouldApplyRequireWrapperOnPackageNames
      ? this.applyGetAbsolutePathWrapper(rendererPackage)
      : rendererPackage;

    const builderPackage = this.getBuilderDetails(builder);
    const builderPackagePath = shouldApplyRequireWrapperOnPackageNames
      ? this.applyGetAbsolutePathWrapper(builderPackage)
      : builderPackage;

    const isExternalFramework = !!this.getExternalFramework(frameworkPackage);
    const isKnownFramework =
      isExternalFramework || !!(versions as Record<string, string>)[frameworkPackage];
    const isKnownRenderer = !!(versions as Record<string, string>)[rendererPackage];

    if (isKnownFramework) {
      return {
        packages: [frameworkPackage],
        frameworkPackagePath,
        frameworkPackage,
        rendererId: renderer,
        type: 'framework',
      };
    }

    if (isKnownRenderer) {
      return {
        packages: [rendererPackage, builderPackage],
        builder: builderPackagePath,
        renderer: rendererPackagePath,
        rendererId: renderer,
        type: 'renderer',
      };
    }

    throw new Error(
      `Could not find the framework (${frameworkPackage}) or renderer (${rendererPackage}) package`
    );
  }
}
