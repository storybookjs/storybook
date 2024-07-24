import { fetchCSSFromGoogleFonts } from "next/dist/compiled/@next/font/dist/google/fetch-css-from-google-fonts";
import { getFontAxes } from "next/dist/compiled/@next/font/dist/google/get-font-axes";
import { getGoogleFontsUrl } from "next/dist/compiled/@next/font/dist/google/get-google-fonts-url";
import { validateGoogleFontFunctionCall } from "next/dist/compiled/@next/font/dist/google/validate-google-font-function-call";
// @ts-expect-error no types
import loaderUtils from "next/dist/compiled/loader-utils3";

const cssCache = new Map<string, string>();

type FontOrigin = string;

export type LocalFontSrc =
  | FontOrigin
  | Array<{ path: FontOrigin; weight?: string; style?: string }>;

export type LoaderOptions = {
  /**
   * Initial import name. Can be `next/font/google` or `next/font/local`
   */
  source: string;
  /**
   * Props passed to the `next/font` function call
   */
  props: {
    src?: LocalFontSrc;
  };
  /**
   * Font Family name
   */
  fontFamily: string;
  /**
   * Filename of the issuer file, which imports `next/font/google` or `next/font/local
   */
  filename: string;
};

export async function getFontFaceDeclarations(options: LoaderOptions) {
  const {
    fontFamily,
    weights,
    styles,
    selectedVariableAxes,
    display,
    variable,
  } = validateGoogleFontFunctionCall(options.fontFamily, options.props);

  const fontAxes = getFontAxes(
    fontFamily,
    weights,
    styles,
    selectedVariableAxes,
  );
  const url = getGoogleFontsUrl(fontFamily, fontAxes, display);

  try {
    const hasCachedCSS = cssCache.has(url);
    const fontFaceCSS = hasCachedCSS
      ? cssCache.get(url)
      : await fetchCSSFromGoogleFonts(url, fontFamily, true).catch(() => null);
    if (!hasCachedCSS) {
      cssCache.set(url, fontFaceCSS as string);
    } else {
      cssCache.delete(url);
    }
    if (fontFaceCSS === null) {
      throw new Error(
        `Failed to fetch \`${fontFamily}\` from Google Fonts with URL: \`${url}\``,
      );
    }

    return {
      id: loaderUtils.getHashDigest(url, "md5", "hex", 6),
      fontFamily,
      fontFaceCSS,
      weights,
      styles,
      variable,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch \`${fontFamily}\` from Google Fonts with URL: \`${url}\``,
    );
  }
}
