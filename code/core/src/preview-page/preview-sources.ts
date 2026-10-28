import '../preview/hooks.ts';

import {
  findConfigFile,
  loadPreviewOrConfigFile,
  normalizeStories,
} from '@storybook/core/internal/common';
import type { NormalizedStoriesSpecifier, PreviewAnnotation } from '@storybook/core/internal/types';

import { isAbsolute, normalize, resolve } from 'pathe';

import type { Storybook } from '../instance/types.ts';
import { builderGlobalsNameReferenceMap } from '../preview/globals/globals.ts';
import { getPreviewModuleIds, type PreviewHmr, type PreviewModuleName } from './constants.ts';
import { getPreviewDefine, type PreviewDefineTarget } from './define.ts';
import { renderPreviewHtml, type PreviewHtmlSlots } from './html.ts';
import { generatePreviewModules, type PreviewModules } from './modules.ts';

/** Everything a builder needs to serve the preview page, independent of the bundler. */
export interface PreviewSources {
  /** Render `iframe.html` around the builder's entry scripts and assets. */
  html(slots: PreviewHtmlSlots): string;
  /** Serve each module under its `virtualModuleIds` entry; the builder generates `importFn`. */
  modules: PreviewModules;
  virtualModuleIds: Record<PreviewModuleName, string>;
  /** Map each module the preview runtime provides to the global that holds it. */
  externals: Record<string, string>;
  /** Compute the bundler define replacements for the target's env syntax. */
  define(target: PreviewDefineTarget): Record<string, string>;
  /** Environment variables exposed to preview code. */
  env: Record<string, string>;
  stories: NormalizedStoriesSpecifier[];
  /** Annotation paths composed by the project annotations module, the user preview last. */
  previewAnnotations: string[];
  /** The page loads the module mocker runtime only when this preview config exists. */
  previewConfigPath: string | undefined;
  previewRuntimePath: string;
}

/** Host and builder inputs to the preview sources. */
export interface PreviewSourcesInput {
  hmr: PreviewHmr;
  previewRuntimePath: string;
  /** Let the preview accept messages from any parent origin. */
  insecureIframeMessaging?: boolean;
}

/** Compute the preview page, its generated modules, externals, and defines for one instance. */
export async function getPreviewSources(
  storybook: Storybook,
  input: PreviewSourcesInput
): Promise<PreviewSources> {
  const { configDir, workingDir, options } = storybook;
  const [
    core,
    build,
    frameworkOptions,
    logLevel,
    headHtmlSnippet,
    bodyHtmlSnippet,
    tags,
    env,
    hmr,
  ] = await Promise.all([
    storybook.callHook('core:config:extend', undefined),
    storybook.callHook('core:build:extend', undefined),
    storybook.callHook('core:framework-options:extend', undefined),
    storybook.callHook('preview:log-level:extend', undefined),
    storybook.callHook('preview:head:extend', undefined),
    storybook.callHook('preview:body:extend', undefined),
    storybook.callHook('core:tags:extend', {}),
    storybook.callHook('core:env:extend', undefined),
    storybook.callHook('preview:hmr:extend', true),
  ]);
  const configType =
    options.configType ?? (storybook.mode === 'build' ? 'PRODUCTION' : 'DEVELOPMENT');
  const stories = normalizeStories(options.stories, { configDir, workingDir });
  const projectRoot = resolve(configDir, '..');
  const userPreview = loadPreviewOrConfigFile({ configDir });
  const userPreviewPath = userPreview && normalize(userPreview);
  const previewAnnotations = [
    ...new Set(
      options.previewAnnotations
        .map((annotation) => toAnnotationPath(annotation, projectRoot))
        .filter((path) => path !== userPreviewPath)
    ),
    ...(userPreviewPath ? [userPreviewPath] : []),
  ];
  const previewConfigPath = findConfigFile('preview', configDir) ?? undefined;
  const virtualModuleIds = getPreviewModuleIds(input.hmr, workingDir);
  const externals: Record<string, string> = { ...builderGlobalsNameReferenceMap };
  if (build?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }
  const defineInput = {
    env: env ?? {},
    developmentModeForBuild:
      !!options.features?.developmentModeForBuild && configType === 'PRODUCTION',
  };
  const globals = {
    CONFIG_TYPE: configType,
    LOGLEVEL: logLevel,
    FRAMEWORK_OPTIONS: frameworkOptions,
    CHANNEL_OPTIONS: core?.channelOptions ?? {},
    FEATURES: options.features ?? {},
    STORIES: stories.map((specifier) => ({
      ...specifier,
      importPathMatcher: specifier.importPathMatcher.source,
    })),
    DOCS_OPTIONS: options.docs ?? {},
    TAGS_OPTIONS: tags ?? {},
    ...(build?.test?.disableBlocks ? { __STORYBOOK_BLOCKS_EMPTY_MODULE__: {} } : {}),
    ...(input.insecureIframeMessaging ? { INSECURE_IFRAME_MESSAGING: true } : {}),
  };

  return {
    html: (slots) =>
      renderPreviewHtml(
        { globals, headHtmlSnippet, bodyHtmlSnippet, mockerRuntime: !!previewConfigPath },
        slots
      ),
    modules: generatePreviewModules({
      hmr: input.hmr,
      ids: virtualModuleIds,
      previewAnnotations,
      previewRuntimePath: input.previewRuntimePath,
      declineHmr: hmr === false,
    }),
    virtualModuleIds,
    externals,
    define: (target) => getPreviewDefine(defineInput, target),
    env: defineInput.env,
    stories,
    previewAnnotations,
    previewConfigPath,
    previewRuntimePath: input.previewRuntimePath,
  };
}

// Addon presets pass `{ bare, absolute }` entries; Nuxt passes an empty `absolute` with a bare specifier.
function toAnnotationPath(annotation: PreviewAnnotation, projectRoot: string): string {
  if (typeof annotation === 'object') {
    return annotation.bare != null && annotation.absolute === ''
      ? annotation.bare
      : normalize(annotation.absolute);
  }
  return normalize(isAbsolute(annotation) ? annotation : resolve(projectRoot, annotation));
}
