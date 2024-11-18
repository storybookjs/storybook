// The MIT License (MIT)
// Copyright (c) 2024 Vercel, Inc.
// https://github.com/vercel/next.js/blob/canary/packages/next/src/build/swc/options.ts
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
import type { EmotionConfig, StyledComponentsConfig } from 'next/dist/server/config-shared.js';

export function getStyledComponentsOptions(
  styledComponentsConfig: undefined | boolean | StyledComponentsConfig,
  development: any
) {
  if (!styledComponentsConfig) {
    return null;
  }

  if (typeof styledComponentsConfig === 'object') {
    return {
      ...styledComponentsConfig,
      displayName: styledComponentsConfig.displayName ?? Boolean(development),
    };
  }

  return {
    displayName: Boolean(development),
  };
}

export function getEmotionOptions(
  emotionConfig: undefined | boolean | EmotionConfig,
  development: boolean
) {
  if (!emotionConfig) {
    return null;
  }
  let autoLabel = !!development;
  switch (typeof emotionConfig === 'object' && emotionConfig.autoLabel) {
    case 'never':
      autoLabel = false;
      break;
    case 'always':
      autoLabel = true;
      break;
    default:
      break;
  }
  return {
    enabled: true,
    autoLabel,
    sourcemap: development,
    ...(typeof emotionConfig === 'object' && {
      importMap: emotionConfig.importMap,
      labelFormat: emotionConfig.labelFormat,
      sourcemap: development && emotionConfig.sourceMap,
    }),
  };
}
