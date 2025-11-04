import fs from "node:fs";
import { createRequire } from "node:module";
import { decode, encode } from "node:querystring";
import { imageSize } from "image-size";
import type { NextConfigComplete } from "next/dist/server/config-shared.js";
import path from "pathe";
import { dedent } from "ts-dedent";
import type { Plugin } from "vite";
import { VITEST_PLUGIN_NAME, isVitestEnv } from "../../utils";
import { getAlias } from "./alias";

const includePattern = /\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/;
const excludeImporterPattern = /\.(css|scss|sass)$/;

const virtualImage = "virtual:next-image";
const virtualNextImage = "virtual:next/image";
const virtualNextLegacyImage = "virtual:next/legacy/image";

const require = createRequire(import.meta.url);

export function vitePluginNextImage(
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>,
) {
  let isBrowser = !isVitestEnv;
  let excludeSvg = false;

  return {
    name: "vite-plugin-storybook-nextjs-image",
    enforce: "pre" as const,
    async config(config, env) {
      if (config.test?.browser?.enabled === true) {
        isBrowser = true;
      }

      // Auto-detect SVGR plugin
      const hasVitePluginSvgr = config.plugins?.some(
        (plugin) =>
          plugin &&
          typeof plugin === "object" &&
          "name" in plugin &&
          (plugin.name === "vite-plugin-svgr" || plugin.name.includes("svgr")),
      );
      if (hasVitePluginSvgr) {
        excludeSvg = true;
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
      if (isSvg && (excludeSvg || queryA === "react")) {
        return null;
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
