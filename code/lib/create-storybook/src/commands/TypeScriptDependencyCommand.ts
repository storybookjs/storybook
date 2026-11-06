import {
  type JsPackageManager,
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  REACT_DOCGEN_FALLBACK_RANGE,
  getTypeScriptUpgradeForDocgen,
  isTypeScript71Stable,
  isTypeScriptUsableForDocgen,
  isCI,
  recommendedTypeScriptDocgenApis,
  typeScriptPackageForDocgen,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { TypeScriptWithoutCompilerApiError } from 'storybook/internal/server-errors';
import { type SupportedFramework, SupportedRenderer } from 'storybook/internal/types';

import { coerce } from 'semver';

import type { DependencyCollector } from '../dependency-collector.ts';
import type { CommandOptions } from '../generators/types.ts';
import { createPromptCancelOptions } from '../prompt-cancel.ts';
import { TelemetryService } from '../services/TelemetryService.ts';

export type TypeScriptDependencyResult =
  | 'added'
  | 'upgraded'
  | 'declined'
  | 'already-installed'
  | 'without-compiler-api'
  | 'not-needed';

type ExecuteTypeScriptDependencyParams = {
  packageManager: JsPackageManager;
  /** `null` for a native-only React Native project, which has no docgen. */
  framework: SupportedFramework | null;
  renderer: SupportedRenderer;
  dependencyCollector: DependencyCollector;
};

export class TypeScriptDependencyCommand {
  constructor(
    private readonly commandOptions: CommandOptions,
    private readonly telemetryService = new TelemetryService(),
    private readonly isInteractive = () =>
      !!process.stdin.isTTY && !!process.stdout.isTTY && !isCI()
  ) {}

  async execute({
    packageManager,
    framework,
    renderer,
    dependencyCollector,
  }: ExecuteTypeScriptDependencyParams): Promise<TypeScriptDependencyResult> {
    const { result, upgrade } = await this.decide(packageManager, framework, renderer);
    if (result === 'added') {
      dependencyCollector.addDevDependencies([
        typeScriptPackageForDocgen(recommendedTypeScriptDocgenApis(renderer)),
      ]);
    }
    if (upgrade) {
      if (upgrade.type === 'dependencies') {
        dependencyCollector.addDependencies([upgrade.dependency]);
      } else {
        dependencyCollector.addDevDependencies([upgrade.dependency]);
      }
    }
    if (result === 'without-compiler-api') {
      await this.warnTypeScriptWithoutCompilerApi(packageManager, renderer, dependencyCollector);
    }
    if (result !== 'not-needed') {
      await this.telemetryService.trackTypeScriptDependency(result);
    }
    return result;
  }

  private async decide(
    packageManager: JsPackageManager,
    framework: SupportedFramework | null,
    renderer: SupportedRenderer
  ): Promise<{
    result: TypeScriptDependencyResult;
    upgrade?: ReturnType<typeof getTypeScriptUpgradeForDocgen>;
  }> {
    if (!framework || !RENDERERS_WITH_TYPESCRIPT_DOCGEN.includes(renderer)) {
      return { result: 'not-needed' };
    }

    const apis = recommendedTypeScriptDocgenApis(renderer);
    if (packageManager.isDependencyInstalled('typescript')) {
      const version = await this.getTypeScriptVersion(packageManager);
      if (version && !isTypeScriptUsableForDocgen(version, apis)) {
        const upgrade = getTypeScriptUpgradeForDocgen(
          apis,
          packageManager.primaryPackageJson.packageJson
        );
        if (
          upgrade &&
          (await this.shouldInstallTypeScript(
            `TypeScript ${version} has no API that Storybook can use to read your component types for Controls and the Docs args table. TypeScript 7.1 and newer do. Do you want to upgrade to ${upgrade.dependency}?`
          ))
        ) {
          return { result: 'upgraded', upgrade };
        }
        return { result: 'without-compiler-api' };
      }
      return { result: 'already-installed' };
    }

    if (
      await this.shouldInstallTypeScript(
        'Storybook uses TypeScript to read your component types for Controls and the Docs args table, also in JavaScript projects. Do you want to install TypeScript?'
      )
    ) {
      return { result: 'added' };
    }
    logger.info(
      renderer === SupportedRenderer.REACT
        ? `Server-side docgen stays off until you add ${typeScriptPackageForDocgen(apis)} to your devDependencies. Until then, Controls and the Docs args table show no props.`
        : `Server-side docgen stays off until you add ${typeScriptPackageForDocgen(apis)} to your devDependencies.`
    );
    return { result: 'declined' };
  }

  private async getTypeScriptVersion(packageManager: JsPackageManager) {
    return coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
  }

  private async warnTypeScriptWithoutCompilerApi(
    packageManager: JsPackageManager,
    renderer: SupportedRenderer,
    dependencyCollector: DependencyCollector
  ) {
    let builderDocgenFallback;
    if (renderer === SupportedRenderer.REACT) {
      let installed = packageManager.isDependencyInstalled('react-docgen');
      if (!installed && !isTypeScript71Stable()) {
        dependencyCollector.addDevDependencies([`react-docgen@${REACT_DOCGEN_FALLBACK_RANGE}`]);
        installed = true;
      }
      builderDocgenFallback = { packageName: 'react-docgen', installed };
    }
    const version = (await this.getTypeScriptVersion(packageManager)) ?? '';
    logger.warn(
      new TypeScriptWithoutCompilerApiError({
        version,
        apis: recommendedTypeScriptDocgenApis(renderer),
        builderDocgenFallback,
      }).message
    );
  }

  private async shouldInstallTypeScript(message: string): Promise<boolean> {
    const { installTypescript, yes } = this.commandOptions;
    if (installTypescript !== undefined) {
      return installTypescript;
    }
    if (yes || !this.isInteractive()) {
      return true;
    }
    return prompt.confirm(
      { message, initialValue: true },
      createPromptCancelOptions(this.telemetryService, 'typescript-dependency')
    );
  }
}

export const executeTypeScriptDependency = ({
  options,
  ...params
}: ExecuteTypeScriptDependencyParams & { options: CommandOptions }) =>
  new TypeScriptDependencyCommand(options).execute(params);
