import path from "node:path";
import type { Plugin } from "vite";

import { getFontFaceDeclarations as getGoogleFontFaceDeclarations } from "./google/get-font-face-declarations";
import { getFontFaceDeclarations as getLocalFontFaceDeclarations } from "./local/get-font-face-declarations";
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

const includePattern = /next(\\|\/|\\\\).*(\\|\/|\\\\)target\.css.*$/;

const virtualModuleId = "virtual:next-font";

export function configureNextFont() {
	return {
		name: "configure-next-font",
		async resolveId(source, importer, options) {
			if (!includePattern.test(source) || !importer) {
				return null;
			}

			const [sourceWithoutQuery, rawQuery] = source.split("?");
			const queryParams = JSON.parse(rawQuery);
			const fileRoot = process.cwd();

			const fontOptions = {
				filename: (queryParams.path as string) ?? "",
				fontFamily: (queryParams.import as string) ?? "",
				props: queryParams.arguments?.[0] ?? {},
				source: importer,
			};

			// Workaround for HTML files because Vite extracts the css and places it in a separate file
			// to inject it in the head of the HTML file
			if (fontOptions.source.endsWith("html")) {
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
				fontFaceDeclaration = await getLocalFontFaceDeclarations(
					fontOptions,
					fileRoot,
				);
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
			const [source, query] = id.split("?");
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
