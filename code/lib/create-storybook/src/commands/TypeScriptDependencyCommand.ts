import {
  type JsPackageManager,
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  REACT_DOCGEN_FALLBACK_RANGE,
  isTypeScript71Stable,
  recordReactDocgenFallback,
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
    const result = await this.decide(packageManager, framework, renderer);
    const typescript = typeScriptPackageForDocgen(recommendedTypeScriptDocgenApis(renderer));
    if (result === 'added') {
      dependencyCollector.addDevDependencies([typescript]);
    }
    // Upgrade the declaration where it is, so the project does not declare two versions.
    if (result === 'upgraded') {
      if (packageManager.primaryPackageJson.packageJson.dependencies?.typescript) {
        dependencyCollector.addDependencies([typescript]);
      } else {
        dependencyCollector.addDevDependencies([typescript]);
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
  ): Promise<TypeScriptDependencyResult> {
    if (!framework || !RENDERERS_WITH_TYPESCRIPT_DOCGEN.includes(renderer)) {
      return 'not-needed';
    }

    const apis = recommendedTypeScriptDocgenApis(renderer);
    if (packageManager.isDependencyInstalled('typescript')) {
      const version = await this.getTypeScriptVersion(packageManager);
      if (version && !isTypeScriptUsableForDocgen(version, apis)) {
        // TypeScript 7.0 has no API; docgen that runs on the native API needs only a newer minor.
        // TEMPORARY(ts-7.1): offered once TypeScript 7.1 is stable.
        if (
          isTypeScript71Stable() &&
          isTypeScriptUsableForDocgen('7.1.0', apis) &&
          (await this.shouldInstallTypeScript(
            `TypeScript ${version} has no API that Storybook can use to read your component types for Controls and the Docs args table. TypeScript 7.1 and newer do. Do you want to upgrade to ${typeScriptPackageForDocgen(apis)}?`
          ))
        ) {
          return 'upgraded';
        }
        return 'without-compiler-api';
      }
      return 'already-installed';
    }

    if (
      await this.shouldInstallTypeScript(
        'Storybook uses TypeScript to read your component types for Controls and the Docs args table, also in JavaScript projects. Do you want to install TypeScript?'
      )
    ) {
      return 'added';
    }
    logger.info(
      renderer === SupportedRenderer.REACT
        ? `Server-side docgen stays off until you add ${typeScriptPackageForDocgen(apis)} to your devDependencies. Until then, Controls and the Docs args table show no props.`
        : `Server-side docgen stays off until you add ${typeScriptPackageForDocgen(apis)} to your devDependencies.`
    );
    return 'declined';
  }

  private async getTypeScriptVersion(packageManager: JsPackageManager) {
    return coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
  }

  // Warn that the TypeScript version has no API docgen can use, and say what docgen does meanwhile.
  private async warnTypeScriptWithoutCompilerApi(
    packageManager: JsPackageManager,
    renderer: SupportedRenderer,
    dependencyCollector: DependencyCollector
  ) {
    let builderDocgenFallback;
    if (renderer === SupportedRenderer.REACT) {
      let installed = packageManager.isDependencyInstalled('react-docgen');
      // TEMPORARY(ts-7.1): until TypeScript 7.1 is stable, React falls back to builder docgen, so add
      // its optional `react-docgen` peer. See `typescript-7-react-docgen-fallback.ts` in core.
      if (!installed && !isTypeScript71Stable()) {
        dependencyCollector.addDevDependencies([`react-docgen@${REACT_DOCGEN_FALLBACK_RANGE}`]);
        recordReactDocgenFallback(packageManager.primaryPackageJson.operationDir);
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
