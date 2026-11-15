import type { Builder, BuilderStats, Builder_Unpromise } from 'storybook/internal/types';

import type { BuildOptions } from 'rolldown';

export type ManagerBuilder = Builder<
  BuildOptions & { entryPoints: string[]; outdir: string },
  BuilderStats
>;

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
