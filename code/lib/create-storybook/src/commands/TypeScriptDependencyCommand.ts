import {
  type JsPackageManager,
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  TYPESCRIPT_FOR_DOCGEN_PACKAGE,
  addReactDocgenFallback,
  hasTypeScriptCompilerApi,
  isCI,
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
    if (result === 'added') {
      dependencyCollector.addDevDependencies([TYPESCRIPT_FOR_DOCGEN_PACKAGE]);
    }
    if (result === 'without-compiler-api') {
      this.warnWithoutCompilerApi(
        packageManager,
        renderer,
        await this.getTypeScriptVersion(packageManager)
      );
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

    if (packageManager.isDependencyInstalled('typescript')) {
      const version = await this.getTypeScriptVersion(packageManager);
      if (version && !hasTypeScriptCompilerApi(version)) {
        return 'without-compiler-api';
      }
      return 'already-installed';
    }

    if (await this.shouldAddTypeScript()) {
      return 'added';
    }
    logger.info(
      renderer === SupportedRenderer.REACT
        ? `Server-side docgen stays off until you add ${TYPESCRIPT_FOR_DOCGEN_PACKAGE} to your devDependencies. Until then, Controls and the Docs args table show no props.`
        : `Server-side docgen stays off until you add ${TYPESCRIPT_FOR_DOCGEN_PACKAGE} to your devDependencies.`
    );
    return 'declined';
  }

  private async getTypeScriptVersion(packageManager: JsPackageManager) {
    return coerce(await packageManager.getDeclaredVersionSpecifier('typescript'))?.version;
  }

  /** Warn that the TypeScript version has no compiler API, and say what docgen does meanwhile. */
  private warnWithoutCompilerApi(
    packageManager: JsPackageManager,
    renderer: SupportedRenderer,
    version = ''
  ) {
    let builderDocgenFallback;
    if (renderer === SupportedRenderer.REACT) {
      // TEMPORARY(ts-7.1): React falls back to builder docgen, so add its optional `react-docgen`
      // peer. See `typescript-7-react-docgen-fallback.ts` in core.
      const installed =
        packageManager.isDependencyInstalled('react-docgen') ||
        addReactDocgenFallback(packageManager);
      builderDocgenFallback = { packageName: 'react-docgen', installed };
    }
    logger.warn(new TypeScriptWithoutCompilerApiError({ version, builderDocgenFallback }).message);
  }

  private async shouldAddTypeScript(): Promise<boolean> {
    const { installTypescript, yes } = this.commandOptions;
    if (installTypescript !== undefined) {
      return installTypescript;
    }
    if (yes || !this.isInteractive()) {
      return true;
    }
    return prompt.confirm(
      {
        message:
          'Storybook uses TypeScript to read your component types for Controls and the Docs args table, also in JavaScript projects. Do you want to install TypeScript?',
        initialValue: true,
      },
      createPromptCancelOptions(this.telemetryService, 'typescript-dependency')
    );
  }
}

export const executeTypeScriptDependency = ({
  options,
  ...params
}: ExecuteTypeScriptDependencyParams & { options: CommandOptions }) =>
  new TypeScriptDependencyCommand(options).execute(params);
