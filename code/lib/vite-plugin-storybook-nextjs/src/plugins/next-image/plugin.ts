import fs from "node:fs";
import { createRequire } from "node:module";
import { decode, encode } from "node:querystring";
import { type FilterPattern, createFilter } from "@rollup/pluginutils";
import { imageSize } from "image-size";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import path from "pathe";
import { dedent } from "ts-dedent";
import type { Plugin } from "vite";
import { VITEST_PLUGIN_NAME, isVitestEnv } from "../../utils";
import { getAlias } from "./alias";

const warnedMessages = new Set<string>();
const warnOnce = (message: string) => {
  if (!warnedMessages.has(message)) {
    console.warn(`[vite-plugin-storybook-nextjs] ${message}`);
    warnedMessages.add(message);
  }
};

const includePattern = /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/;
const excludeImporterPattern = /\.(css|scss|sass)$/;

const virtualImage = "virtual:next-image";
const virtualNextImage = "virtual:next/image";
const virtualNextLegacyImage = "virtual:next/legacy/image";

const require = createRequire(import.meta.url);

export type NextImagePluginOptions = {
  includeFiles?: FilterPattern;
  excludeFiles?: FilterPattern;
};

export function vitePluginNextImage(
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
  options: NextImagePluginOptions = {},
) {
  let isBrowser = !isVitestEnv;
  let hasVitePluginSvgr = false;
  const postfixRE = /[?#].*$/s;
  const filter = createFilter(
    [
      "**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}",
      "**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}?*",
      "**/*.{png,jpg,jpeg,gif,webp,avif,ico,bmp,svg}#*",
    ],
    options.excludeFiles,
  );

  return {
    name: "vite-plugin-storybook-nextjs-image",
    enforce: "pre" as const,
    async configResolved(config) {
      // Auto-detect SVGR plugin
      hasVitePluginSvgr = !!config.plugins?.some(
        (plugin) =>
          plugin &&
          typeof plugin === "object" &&
          "name" in plugin &&
          (plugin.name === "vite-plugin-svgr" || plugin.name.includes("svgr")),
      );
    },
    async config(config, env) {
      if (config.test?.browser?.enabled === true) {
        isBrowser = true;
      }

      return {
        resolve: {
          alias: getAlias(isBrowser ? "browser" : "node"),
        },
      };
    },
    async resolveId(id, importer) {
      const [source, queryA] = id.split("?");

      if (queryA === "ignore") {
        return null;
      }

      // For SVG files, only process if they don't have ?react parameter and SVG processing is enabled
      const isSvg = /\.svg$/.test(source);
      if (isSvg && hasVitePluginSvgr && queryA === "react") {
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
          
          For more info and recommended configuration, see: https://github.com/storybookjs/vite-plugin-storybook-nextjs/blob/main/README.md#faq-includingexcluding-images`,
        );
      }

      if (
        includePattern.test(source) &&
        !excludeImporterPattern.test(importer ?? "") &&
        !importer?.startsWith(virtualImage)
      ) {
        const isAbsolute = path.isAbsolute(id);
        const imagePath = importer
          ? isAbsolute
            ? source
            : path.join(path.dirname(importer), source)
          : source;

        const pathForFilter = imagePath.replace(postfixRE, "");

        if (!filter(pathForFilter)) {
          return null;
        }

        return `${virtualImage}?${encode({ imagePath })}`;
      }

      if (id === "next/image" && importer !== virtualNextImage) {
        return virtualNextImage;
      }

      if (id === "next/legacy/image" && importer !== virtualNextLegacyImage) {
        return virtualNextLegacyImage;
      }

      return null;
    },

    async load(id) {
      const aliasEnv = isBrowser ? "browser" : "node";
      if (virtualNextImage === id) {
        return (
          await fs.promises.readFile(
            require.resolve(`${VITEST_PLUGIN_NAME}/${aliasEnv}/mocks/image`),
          )
        ).toString("utf-8");
      }

      if (virtualNextLegacyImage === id) {
        return (
          await fs.promises.readFile(
            require.resolve(
              `${VITEST_PLUGIN_NAME}/${aliasEnv}/mocks/legacy-image`,
            ),
          )
        ).toString("utf-8");
      }

      const [source, query] = id.split("?");

      if (virtualImage === source) {
        const imagePath = decode(query).imagePath as string;

        const nextConfig = await nextConfigResolver.promise;

        try {
          if (nextConfig.images?.disableStaticImages) {
            return dedent`
						import image from "${imagePath}?ignore";
						export default image;
					`;
          }

          const imageData = await fs.promises.readFile(imagePath);

          const { width, height } = imageSize(imageData);

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
