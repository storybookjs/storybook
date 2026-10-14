import {
  ComponentMetaManager,
  type ComponentMetaProjectFactory,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';

import type * as ts from 'typescript';

import type { GeneratorAdapter } from './generator.ts';
import { GeneratorProject } from './generator-project.ts';

export class GeneratorManager extends ComponentMetaManager<GeneratorProject, ts.ParsedCommandLine> {
  constructor(typescript: typeof ts, generator: GeneratorAdapter) {
    super(typescript, createGeneratorProjectFactory(typescript, generator));
  }
}

function createGeneratorProjectFactory(
  typescript: typeof ts,
  generator: GeneratorAdapter
): ComponentMetaProjectFactory<GeneratorProject, ts.ParsedCommandLine> {
  return {
    // Web components are often plain JavaScript, so JS stories must match their tsconfig even
    // when it does not set `allowJs`.
    parseCommandLine: (tsconfig) =>
      parseTsconfigCommandLine<ts.ParsedCommandLine>(typescript, tsconfig, undefined, {
        allowJs: true,
      }),
    createConfiguredProject: (commandLine, tsconfig, getCommandLine) =>
      new GeneratorProject(typescript, generator, commandLine, tsconfig, getCommandLine),
    createInferredProject: () =>
      new GeneratorProject(
        typescript,
        generator,
        {
          options: {
            allowJs: true,
            target: typescript.ScriptTarget.Latest,
            module: typescript.ModuleKind.ESNext,
            moduleResolution: typescript.ModuleResolutionKind.Bundler,
          },
          fileNames: [],
          errors: [],
        },
        undefined
      ),
  };
}
