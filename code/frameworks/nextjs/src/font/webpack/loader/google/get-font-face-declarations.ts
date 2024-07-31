// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import loaderUtils from 'next/dist/compiled/loader-utils3';
import {
  GoogleFontsDownloadError,
  GoogleFontsLoadingError,
} from 'storybook/internal/server-errors';
import { validateGoogleFontFunctionCall } from 'next/dist/compiled/@next/font/dist/google/validate-google-font-function-call';
import { getGoogleFontsUrl } from 'next/dist/compiled/@next/font/dist/google/get-google-fonts-url';
import { getFontAxes } from 'next/dist/compiled/@next/font/dist/google/get-font-axes';
import { fetchCSSFromGoogleFonts } from 'next/dist/compiled/@next/font/dist/google/fetch-css-from-google-fonts';
import type { LoaderOptions } from '../types';

const cssCache = new Map<string, string>();

export async function getFontFaceDeclarations(options: LoaderOptions) {
  const { fontFamily, weights, styles, selectedVariableAxes, display, variable } =
    validateGoogleFontFunctionCall(options.fontFamily, options.props);

  const fontAxes = getFontAxes(fontFamily, weights, styles, selectedVariableAxes);
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
      throw new GoogleFontsDownloadError({
        fontFamily,
        url,
      });
    }

    return {
      id: loaderUtils.getHashDigest(url, 'md5', 'hex', 6),
      fontFamily,
      fontFaceCSS,
      weights,
      styles,
      variable,
    };
  } catch (error) {
    throw new GoogleFontsLoadingError({ error, url });
  }
}
