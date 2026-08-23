import type { StylePreprocessorOptions } from '@angular-devkit/build-angular';
import type {
  AssetPattern,
  SourceMapUnion,
  StyleElement,
} from '@angular-devkit/build-angular/src/builders/browser/schema';

export type StylingBuilderOptions = {
  styles?: StyleElement[];
  stylePreprocessorOptions?: StylePreprocessorOptions;
  assets?: AssetPattern[];
  sourceMap?: SourceMapUnion;
  preserveSymlinks?: boolean;
};

type BrowserTargetOptions = Partial<
  StylingBuilderOptions & {
    tsConfig: string;
  }
>;

/**
 * Merge the styling-related options of the `browserTarget` referenced by a
 * Storybook target underneath the Storybook target's own options.
 *
 * The Storybook target's own options always win; options inherited from the
 * browser target only fill the gaps. This mirrors how `@storybook/angular`
 * deep-merges browser-target options for webpack, and fixes the angular-vite
 * builders silently discarding everything but `tsConfig` from the validated
 * browser-target options (https://github.com/storybookjs/storybook/issues/36009).
 */
export const mergeBrowserTargetOptions = <T extends StylingBuilderOptions>(
  ownOptions: T,
  browserTargetOptions: BrowserTargetOptions | undefined
): T => {
  if (!browserTargetOptions) {
    return ownOptions;
  }

  return {
    ...ownOptions,
    styles: ownOptions.styles ?? browserTargetOptions.styles,
    stylePreprocessorOptions:
      ownOptions.stylePreprocessorOptions ?? browserTargetOptions.stylePreprocessorOptions,
    assets: ownOptions.assets ?? browserTargetOptions.assets,
    sourceMap: ownOptions.sourceMap ?? browserTargetOptions.sourceMap,
    preserveSymlinks: ownOptions.preserveSymlinks ?? browserTargetOptions.preserveSymlinks,
  };
};