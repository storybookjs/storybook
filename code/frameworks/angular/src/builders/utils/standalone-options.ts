import { BuilderContext } from '@angular-devkit/architect';
import {
  AssetPattern,
  SourceMapUnion,
  StyleElement,
  StylePreprocessorOptions,
} from '@angular-devkit/build-angular/src/builders/browser/schema';
import { LoadOptions, CLIOptions, BuilderOptions } from 'storybook/internal/types';

export type StandaloneOptions = CLIOptions &
  LoadOptions &
  BuilderOptions & {
    mode?: 'static' | 'dev';
    enableProdMode: boolean;
    angularBrowserTarget?: string | null;
    angularBuilderOptions?: Record<string, any> & {
      styles?: StyleElement[];
      stylePreprocessorOptions?: StylePreprocessorOptions;
      assets?: AssetPattern[];
      sourceMap?: SourceMapUnion;
      preserveSymlinks?: boolean;
    };
    angularBuilderContext?: BuilderContext | null;
    tsConfig?: string;
  };
