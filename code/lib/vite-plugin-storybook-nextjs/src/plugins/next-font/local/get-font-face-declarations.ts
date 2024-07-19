import path from "node:path";
import { validateLocalFontFunctionCall } from "next/dist/compiled/@next/font/dist/local/validate-local-font-function-call";
// @ts-expect-error no types
import loaderUtils from "next/dist/compiled/loader-utils3";

import type { LoaderOptions } from "../types";
import { getProjectRoot } from "../utils/get-project-root";

type LocalFontSrc =
	| string
	| Array<{ path: string; weight?: string; style?: string }>;

export async function getFontFaceDeclarations(
	options: LoaderOptions,
	rootContext: string,
) {
	const localFontSrc = options.props.src as LocalFontSrc;

	// Parent folder relative to the root context
	const parentFolder = path
		.dirname(path.join(process.cwd(), options.filename))
		.replace(rootContext, "");

	const {
		weight,
		style,
		variable,
		declarations = [],
	} = validateLocalFontFunctionCall("", options.props);

	const id = `font-${loaderUtils.getHashDigest(
		Buffer.from(JSON.stringify(localFontSrc)),
		"md5",
		"hex",
		6,
	)}`;

	const fontDeclarations = declarations
		.map(
			({ prop, value }: { prop: string; value: string }) =>
				`${prop}: ${value};`,
		)
		.join("\n");

	const getFontFaceCSS = () => {
		if (typeof localFontSrc === "string") {
			const localFontPath = path
				.join(parentFolder, localFontSrc)
				.replaceAll("\\", "/");

			return `@font-face {
          font-family: ${id};
          src: url(.${localFontPath});
          ${fontDeclarations}
      }`;
		}
		return localFontSrc
			.map((font) => {
				const localFontPath = path
					.join(parentFolder, font.path)
					.replaceAll("\\", "/");

				return `@font-face {
          font-family: ${id};
          src: url(.${localFontPath});
          ${font.weight ? `font-weight: ${font.weight};` : ""}
          ${font.style ? `font-style: ${font.style};` : ""}
          ${fontDeclarations}
        }`;
			})
			.join("");
	};

	return {
		id,
		fontFamily: id,
		fontFaceCSS: getFontFaceCSS(),
		weights: weight ? [weight] : [],
		styles: style ? [style] : [],
		variable,
	};
}
