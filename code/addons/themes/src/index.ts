import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { ThemesTypes } from './types';
import {
  withThemeByClassName,
  withThemeByDataAttribute,
  withThemeFromJSXProvider,
} from './decorators';

export type { ThemesGlobals, ThemesTypes } from './types';

export * from './decorators';

function addonThemes() {
  return definePreviewAddon<ThemesTypes>(addonAnnotations);
}

addonThemes.withThemeByClassName = withThemeByClassName;
addonThemes.withThemeByDataAttribute = withThemeByDataAttribute;
addonThemes.withThemeFromJSXProvider = withThemeFromJSXProvider;

export default addonThemes;
