import {
  type JsPackageManager,
  RENDERERS_WITH_TYPESCRIPT_DOCGEN,
  getTypeScriptDocgenApi,
  isCI,
  typeScriptDocgenApisFor,
  typeScriptPackageForDocgen,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { TypeScriptWithoutCompilerApiError } from 'storybook/internal/server-errors';
import type { SupportedRenderer } from 'storybook/internal/types';

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
  renderer: SupportedRenderer;
  dependencyCollector: DependencyCollector;
};

export class TypeScriptDependencyCommand {
  constructor(
    private readonly commandOptions: CommandOptions,
    private readonly telemetryService = new TelemetryService(),
    private readonly isInteractive = () => !!process.stdout.isTTY && !isCI()
  ) {}

  async execute({
    packageManager,
    renderer,
    dependencyCollector,
  }: ExecuteTypeScriptDependencyParams): Promise<TypeScriptDependencyResult> {
    const result = await this.decide(packageManager, renderer);
    if (result === 'added') {
      dependencyCollector.addDevDependencies([
        typeScriptPackageForDocgen(typeScriptDocgenApisFor(renderer)),
      ]);
    }
    if (result !== 'not-needed') {
      await this.telemetryService.trackTypeScriptDependency(result);
    }
    return result;
  }

  private async decide(
    packageManager: JsPackageManager,
    renderer: SupportedRenderer
  ): Promise<TypeScriptDependencyResult> {
    if (!RENDERERS_WITH_TYPESCRIPT_DOCGEN.includes(renderer)) {
      return 'not-needed';
    }

    const apis = typeScriptDocgenApisFor(renderer);
    if (packageManager.isDependencyInstalled('typescript')) {
      const version = coerce(
        await packageManager.getDeclaredVersionSpecifier('typescript')
      )?.version;
      const api = version && getTypeScriptDocgenApi(version);
      if (version && !(api && apis.includes(api))) {
        logger.warn(new TypeScriptWithoutCompilerApiError({ version, apis }).message);
        return 'without-compiler-api';
      }
      return 'already-installed';
    }

    if (await this.shouldAddTypeScript()) {
      return 'added';
    }
    logger.info(
      `Server-side docgen stays off until you add ${typeScriptPackageForDocgen(apis)} to your devDependencies.`
    );
    return 'declined';
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
