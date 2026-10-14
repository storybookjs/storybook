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
    // A JS story outside a tsconfig's files falls to the inferred project, whose generator run
    // scans the story's folder with `allowJs`; matching it to the tsconfig would hide it instead.
    parseCommandLine: (tsconfig) =>
      parseTsconfigCommandLine<ts.ParsedCommandLine>(typescript, tsconfig),
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
