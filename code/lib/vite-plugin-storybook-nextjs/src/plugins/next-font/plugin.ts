import fs from "node:fs/promises";
import path from "node:path";
// @ts-expect-error no types
import loaderUtils from "next/dist/compiled/loader-utils3";
import type { Plugin } from "vite";

import { getFontFaceDeclarations as getGoogleFontFaceDeclarations } from "./google/get-font-face-declarations";
import {
	type LocalFontSrc,
	getFontFaceDeclarations as getLocalFontFaceDeclarations,
} from "./local/get-font-face-declarations";
import { getCSSMeta } from "./utils/get-css-meta";
import { setFontDeclarationsInHead } from "./utils/set-font-declarations-in-head";

type FontFaceDeclaration = {
	id: string;
	fontFamily: string;
	fontFaceCSS: unknown;
	weights: string[];
	styles: string[];
	variable?: string;
};

type FontOptions = {
	filename: string;
	fontFamily: string;
	props: {
		src?: LocalFontSrc;
	};
	source: string;
};

const includePattern = /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css.*$/;

const virtualModuleId = "virtual:next-font";

export function configureNextFont() {
	let devMode = true;
	const fontAssetPaths = new Map<string, string>();

	return {
		name: "configure-next-font",
		async config(config, env) {
			devMode = env.mode === "development";

			return config;
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (req.url && fontAssetPaths.has(req.url)) {
					// biome-ignore lint/style/noNonNullAssertion: <explanation>
					const fontAbsoluteAssetPath = fontAssetPaths.get(req.url)!;
					const fontFileExtension = path.extname(fontAbsoluteAssetPath);
					try {
						const fontData = await fs.readFile(fontAbsoluteAssetPath);
						// set content type dependent of the file extension
						switch (fontFileExtension) {
							case ".woff":
								res.setHeader("Content-Type", "font/woff");
								break;
							case ".woff2":
								res.setHeader("Content-Type", "font/woff2");
								break;
							case ".ttf":
								res.setHeader("Content-Type", "font/ttf");
								break;
							case ".otf":
								res.setHeader("Content-Type", "font/otf");
								break;
							default:
								res.setHeader("Content-Type", "font");
						}
						res.end(fontData);
					} catch (e) {
						console.error(
							`Could not read font file ${fontAbsoluteAssetPath}:`,
							e,
						);
						res.statusCode = 404;
						res.end();
					}
				} else {
					next();
				}
			});
		},
		async resolveId(source, importer) {
			if (!includePattern.test(source) || !importer) {
				return null;
			}

			const [sourceWithoutQuery, rawQuery] = source.split("?");
			const queryParams = JSON.parse(rawQuery);

			const fontOptions = {
				filename: (queryParams.path as string) ?? "",
				fontFamily: (queryParams.import as string) ?? "",
				props: queryParams.arguments?.[0] ?? {},
				source: importer,
			} as FontOptions;

			if (fontOptions.source.endsWith("html")) {
				// Workaround for HTML files because Vite extracts the css and places it in a separate file
				// to inject it in the head of the HTML file
				return null;
			}

			let fontFaceDeclaration: FontFaceDeclaration | undefined;

			const pathSep = path.sep;

			if (
				sourceWithoutQuery.endsWith(
					["next", "font", "google", "target.css"].join(pathSep),
				)
			) {
				fontFaceDeclaration = await getGoogleFontFaceDeclarations(fontOptions);
			}

			if (
				sourceWithoutQuery.endsWith(
					["next", "font", "local", "target.css"].join(pathSep),
				)
			) {
				const importerDirPath = path.dirname(fontOptions.filename);

				const emitFont = async (importerRelativeFontPath: string) => {
					const fontExtension = path.extname(importerRelativeFontPath);
					const fontBaseName = path.basename(
						importerRelativeFontPath,
						fontExtension,
					);

					const fontPath = path.join(importerDirPath, importerRelativeFontPath);

					if (devMode) {
						fontAssetPaths.set(importerRelativeFontPath, fontPath);
						return importerRelativeFontPath;
					}

					try {
						const fontData = await fs.readFile(fontPath);

						const fileHash = loaderUtils.getHashDigest(
							fontData,
							"md5",
							"hex",
							8,
						);

						const fontReferenceId = this.emitFile({
							fileName: path.join(
								importerDirPath,
								`${fontBaseName}-${fileHash}${fontExtension}`,
							),
							type: "asset",
							source: fontData,
						});

						return `/${this.getFileName(fontReferenceId)}`;
					} catch (err) {
						console.error(`Could not read font file ${fontPath}:`, err);
						return undefined;
					}
				};

				if (fontOptions.props.src) {
					if (typeof fontOptions.props.src === "string") {
						const fontPath = await emitFont(fontOptions.props.src);
						fontOptions.props.src = fontPath;
					} else {
						fontOptions.props.src = await Promise.all(
							(fontOptions.props.src ?? []).map(async (font) => {
								const fontPath = await emitFont(font.path);
								return {
									...font,
									path: fontPath ?? "",
								};
							}),
						);
					}
				}

				fontFaceDeclaration = await getLocalFontFaceDeclarations(fontOptions);
			}

			return {
				id: `${virtualModuleId}?${rawQuery}`,
				meta: {
					fontFaceDeclaration,
				},
			};
		},
		load(id) {
			// Check if the file matches the specific pattern
			const [source] = id.split("?");
			if (source !== virtualModuleId) {
				return undefined;
			}

			const moduleInfo = this.getModuleInfo(id);

			const fontFaceDeclaration = moduleInfo?.meta?.fontFaceDeclaration;

			if (typeof fontFaceDeclaration !== "undefined") {
				const cssMeta = getCSSMeta(fontFaceDeclaration);

				return `
				${setFontDeclarationsInHead({
					fontFaceCSS: cssMeta.fontFaceCSS,
					id: fontFaceDeclaration.id,
					classNamesCSS: cssMeta.classNamesCSS,
				})}
			
				export default {
				  className: "${cssMeta.className}", 
				  style: ${JSON.stringify(cssMeta.style)}
				  ${cssMeta.variableClassName ? `, variable: "${cssMeta.variableClassName}"` : ""}
				}
				`;
			}

			return "export default {}";
		},
	} satisfies Plugin;
}
