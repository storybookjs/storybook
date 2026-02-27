import type {
  Builder,
  BuilderStats,
  Builder_Unpromise,
  Builder_WithRequiredProperty,
} from 'storybook/internal/types';

import type { OutputOptions, RolldownOptions, RolldownOutput } from 'rolldown';

export type ManagerBuilderConfig = {
  inputOptions: RolldownOptions;
  outputOptions: OutputOptions;
  outdir: string;
};

export type ManagerBuilder = Builder<
  Builder_WithRequiredProperty<ManagerBuilderConfig, 'outdir'>,
  BuilderStats
>;
export type Compilation = RolldownOutput;

export type BuilderStartOptions = Parameters<ManagerBuilder['start']>['0'];
export type BuilderStartResult = Builder_Unpromise<ReturnType<ManagerBuilder['start']>>;

export type StarterFunction = (
  options: BuilderStartOptions
) => AsyncGenerator<unknown, BuilderStartResult | void, void>;

export type BuilderBuildOptions = Parameters<ManagerBuilder['build']>['0'];
export type BuilderBuildResult = Builder_Unpromise<ReturnType<ManagerBuilder['build']>>;
export type BuilderFunction = (
  options: BuilderBuildOptions
) => AsyncGenerator<unknown, BuilderBuildResult, void>;
