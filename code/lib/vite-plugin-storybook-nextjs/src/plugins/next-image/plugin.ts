import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { type FilterPattern, createFilter } from '@rollup/pluginutils';
import type { NextConfigComplete } from 'next/dist/server/config-shared.js';
import path from 'pathe';
import probeSync from 'probe-image-size/sync.js';
import { dedent } from 'ts-dedent';
import type { Plugin } from 'vite';
import { VITEST_PLUGIN_NAME, isVitestEnv } from '../../utils.ts';
import { getAlias } from './alias/index.tsx';

const warnedMessages = new Set<string>();
const warnOnce = (message: string) => {
  if (!warnedMessages.has(message)) {
    console.warn(`[vite-plugin-storybook-nextjs] ${message}`);
    warnedMessages.add(message);
  }
};

const includePattern = /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/;
const excludeImporterPattern = /\.(css|scss|sass)$/;

const virtualImagePrefix = '\0virtual:next-image:';
const virtualImage = 'virtual:next-image';
const virtualNextImage = 'virtual:next/image';
const virtualNextLegacyImage = 'virtual:next/legacy/image';
const SHORT_HASH_LEN = 8;

const require = createRequire(import.meta.url);

export type NextImagePluginOptions = {
  includeFiles?: FilterPattern;
  excludeFiles?: FilterPattern;
};

export function vitePluginNextImage(
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
  options: NextImagePluginOptions = {}
) {
  let isBrowser = !isVitestEnv;
  let hasVitePluginSvgr = false;
  const postfixRE = /[?#].*$/s;
  const filter = createFilter(
    options.includeFiles ?? [
      '**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}',
      '**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}?*',
      '**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}#*',
    ],
    options.excludeFiles
  );

  const imagePathByHash = new Map<string, string>();

  function registerImagePath(imagePath: string): string {
    const full = createHash('sha256').update(imagePath).digest('hex');
    const short = full.slice(0, SHORT_HASH_LEN);
    const existing = imagePathByHash.get(short);
    if (existing === imagePath) {
      return short;
    }
    if (existing === undefined) {
      imagePathByHash.set(short, imagePath);
      return short;
    }
    imagePathByHash.set(full, imagePath);
    return full;
  }

  return {
    name: 'vite-plugin-storybook-nextjs-image',
    enforce: 'pre' as const,
    async configResolved(config) {
      // Auto-detect SVGR plugin
      hasVitePluginSvgr = !!config.plugins?.some(
        (plugin) =>
          plugin &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          (plugin.name === 'vite-plugin-svgr' || plugin.name.includes('svgr'))
      );
    },
    async config(config, env) {
      if (config.test?.browser?.enabled === true) {
        isBrowser = true;
      }

      return {
        resolve: {
          alias: getAlias(isBrowser ? 'browser' : 'node'),
        },
      };
    },
    async resolveId(id, importer) {
      const [source, queryA] = id.split('?');

      if (queryA === 'ignore') {
        return null;
      }

      // For SVG files, only process if they don't have ?react parameter and SVG processing is enabled
      const isSvg = /\.svg$/.test(source);
      if (isSvg && hasVitePluginSvgr && queryA === 'react') {
        return null;
      }

      if (
        isSvg &&
        hasVitePluginSvgr &&
        !options.includeFiles &&
        !options.excludeFiles &&
        queryA !== undefined
      ) {
        // If we hit this, it means the user has custom svgr config which we can't do much about
        // So we warn that they should pass include/exclude patterns themselves as framework options.
        warnOnce(
          dedent`Detected vite-plugin-svgr but you are not passing image include or exclude patterns to the nextjs-vite plugin. This may cause a conflict between the two plugins and issues with SVG files.
          
          For more info and recommended configuration, see: https://github.com/storybookjs/storybook/blob/next/code/lib/vite-plugin-storybook-nextjs/README.md#faq-includingexcluding-images`
        );
      }

      if (
        includePattern.test(source) &&
        !excludeImporterPattern.test(importer ?? '') &&
        !importer?.startsWith(virtualImagePrefix)
      ) {
        const isAbsolute = path.isAbsolute(source);
        const importerPath = importer?.split('?')[0];
        let imagePath = source;

        if (importerPath && !isAbsolute) {
          if (source.startsWith('.')) {
            imagePath = path.join(path.dirname(importerPath), source);
          } else {
            const resolvedByVite = await this.resolve(source, importer, {
              skipSelf: true,
            });

            if (resolvedByVite?.id) {
              imagePath = resolvedByVite.id.split('?')[0];
            } else {
              try {
                imagePath = require.resolve(source, {
                  paths: [path.dirname(importerPath)],
                });
              } catch {
                imagePath = source;
              }
            }
          }
        }

        const pathForFilter = imagePath.replace(postfixRE, '');

        if (!filter(pathForFilter)) {
          return null;
        }

        return `${virtualImagePrefix}${registerImagePath(imagePath)}`;
      }

      if (id === 'next/image' && importer !== virtualNextImage) {
        return virtualNextImage;
      }

      if (id === 'next/legacy/image' && importer !== virtualNextLegacyImage) {
        return virtualNextLegacyImage;
      }

      return null;
    },

    async load(id) {
      const aliasEnv = isBrowser ? 'browser' : 'node';
      if (virtualNextImage === id) {
        return (
          await fs.promises.readFile(
            require.resolve(`${VITEST_PLUGIN_NAME}/${aliasEnv}/mocks/image`)
          )
        ).toString('utf-8');
      }

      if (virtualNextLegacyImage === id) {
        return (
          await fs.promises.readFile(
            require.resolve(`${VITEST_PLUGIN_NAME}/${aliasEnv}/mocks/legacy-image`)
          )
        ).toString('utf-8');
      }

      if (id.startsWith(virtualImagePrefix)) {
        const imagePath = imagePathByHash.get(id.slice(virtualImagePrefix.length));
        if (imagePath === undefined) {
          return null;
        }

        const nextConfig = await nextConfigResolver.promise;

        try {
          if (nextConfig.images?.disableStaticImages) {
            return dedent`
						import image from "${imagePath}?ignore";
						export default image;
					`;
          }

          const imageData = await fs.promises.readFile(imagePath);

          const size = probeSync(imageData);

          // probe-image-size returns null instead of throwing on unrecognized data
          if (!size) {
            throw new Error('Unsupported or corrupt image file');
          }

          const { width, height } = size;

          return dedent`
						import src from "${imagePath}?ignore";
						export default {
							src,
							height: ${height},
							width: ${width},
							blurDataURL: src
						};
					`;
        } catch (err) {
          console.error(`Could not read image file ${imagePath}:`, err);
          return undefined;
        }
      }

      return null;
    },
  } satisfies Plugin;
}
