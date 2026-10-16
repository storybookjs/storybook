import type { BuilderContext } from '@angular-devkit/architect';
import type { BuilderOptions, CLIOptions, LoadOptions } from 'storybook/internal/types';

export type StandaloneOptions = CLIOptions &
  LoadOptions &
  BuilderOptions & {
    mode?: 'static' | 'dev';
    enableProdMode: boolean;
    angularBrowserTarget: string | null;
    angularBuilderOptions?: Record<string, any> & {
      zoneless?: boolean;
    };
    angularBuilderContext?: BuilderContext | null;
    tsConfig?: string;
  };
