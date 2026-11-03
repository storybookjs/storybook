import {
  type JsPackageManager,
  REACT_DOCGEN_FALLBACK_PACKAGE,
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  TYPESCRIPT_FOR_DOCGEN_PACKAGE,
  hasTypeScriptCompilerApi,
  isCI,
  recordTemporaryDependency,
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
    if (this.needsReactDocgenFallback(result, renderer, packageManager)) {
      // TEMPORARY until Storybook supports TypeScript 7.1: see `typescript-7-react-docgen-fallback.ts`.
      dependencyCollector.addDevDependencies([REACT_DOCGEN_FALLBACK_PACKAGE]);
      recordTemporaryDependency(packageManager, 'react-docgen');
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
      const version = coerce(
        await packageManager.getDeclaredVersionSpecifier('typescript')
      )?.version;
      if (version && !hasTypeScriptCompilerApi(version)) {
        // React falls back to builder docgen. Until Storybook supports TypeScript 7.1, init adds its
        // optional `react-docgen` peer (see `execute`), so the fallback runs.
        const builderDocgenFallback =
          renderer === SupportedRenderer.REACT
            ? { packageName: 'react-docgen', installed: true }
            : undefined;
        logger.warn(
          new TypeScriptWithoutCompilerApiError({ version, builderDocgenFallback }).message
        );
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

  /**
   * TEMPORARY until Storybook supports TypeScript 7.1, which gives TypeScript 7 projects the docgen
   * server: a React project on TypeScript 7.0 gets `react-docgen`, so it has docgen at all. See
   * `typescript-7-react-docgen-fallback.ts` in core.
   */
  private needsReactDocgenFallback(
    result: TypeScriptDependencyResult,
    renderer: SupportedRenderer,
    packageManager: JsPackageManager
  ) {
    return (
      result === 'without-compiler-api' &&
      renderer === SupportedRenderer.REACT &&
      !packageManager.isDependencyInstalled('react-docgen')
    );
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
