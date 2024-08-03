import type {
  Builder,
  Builder_WithRequiredProperty,
  BuilderStats,
  Builder_Unpromise,
} from '@storybook/core/types';

import type { BuildOptions, BuildResult } from 'esbuild';

export type ManagerBuilder = Builder<
  Builder_WithRequiredProperty<BuildOptions, 'outdir'> & { entryPoints: string[] },
  BuilderStats
>;
export type Compilation = BuildResult;

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
