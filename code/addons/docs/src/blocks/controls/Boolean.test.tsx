// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { convert, themes } from 'storybook/theming';
import type { CSSObject, Interpolation } from 'storybook/theming';

import { getBooleanControlStyles } from './Boolean';

const asCssObject = (value: Interpolation<unknown> | undefined): CSSObject =>
  (value || {}) as CSSObject;

describe('BooleanControl', () => {
  it('emits explicit forced-colors styles for the selected state', () => {
    const styles = getBooleanControlStyles(convert(themes.light));
    const labelForcedColors = asCssObject(styles['@media (forced-colors: active)']);
    const focusWithinStyles = asCssObject(styles['&:focus-within']);
    const focusWithinForcedColors = asCssObject(
      focusWithinStyles['@media (forced-colors: active)']
    );
    const inputStyles = asCssObject(styles.input);
    const spanStyles = asCssObject(styles.span);
    const spanForcedColors = asCssObject(spanStyles['@media (forced-colors: active)']);
    const selectedStyles = asCssObject(
      styles['input:checked ~ span:last-of-type, input:not(:checked) ~ span:first-of-type']
    );
    const selectedForcedColors = asCssObject(selectedStyles['@media (forced-colors: active)']);

    expect(labelForcedColors).toMatchObject({
      background: 'ButtonFace',
      outline: '1px solid ButtonText',
    });

    expect(focusWithinStyles).toMatchObject({
      outline: 'none',
    });
    expect(focusWithinForcedColors).toMatchObject({
      outline: '1px solid Highlight',
      outlineOffset: 1,
    });

    expect(inputStyles).toMatchObject({
      width: 1,
      height: 1,
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    });

    expect(spanForcedColors).toMatchObject({
      color: 'ButtonText',
      boxShadow: 'none',
    });

    expect(selectedForcedColors).toMatchObject({
      forcedColorAdjust: 'none',
      background: 'Highlight',
      color: 'HighlightText',
      boxShadow: 'none',
      outline: '1px solid ButtonText',
    });

    expect(selectedForcedColors).not.toHaveProperty('textDecoration');
  });
});
