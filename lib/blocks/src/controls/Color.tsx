import type { ChangeEvent, FC, FocusEvent } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Form, TooltipNote, WithTooltip } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { MarkupIcon } from '@storybook/icons';

import convert from 'color-convert';
import { debounce } from 'es-toolkit/compat';
import { HexColorPicker, HslaStringColorPicker, RgbaStringColorPicker } from 'react-colorful';

import { getControlId } from './helpers';
import type { ColorConfig, ColorValue, ControlProps, PresetColor } from './types';

const Wrapper = styled.div({
  position: 'relative',
  maxWidth: 250,
  '&[aria-readonly="true"]': {
    opacity: 0.5,
  },
});

const PickerTooltip = styled(WithTooltip)({
  position: 'absolute',
  zIndex: 1,
  top: 4,
  left: 4,
  '[aria-readonly=true] &': {
    cursor: 'not-allowed',
  },
});

const TooltipContent = styled.div({
  width: 200,
  margin: 5,

  '.react-colorful__saturation': {
    borderRadius: '4px 4px 0 0',
  },
  '.react-colorful__hue': {
    boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 5%)',
  },
  '.react-colorful__last-control': {
    borderRadius: '0 0 4px 4px',
  },
});

const Note = styled(TooltipNote)(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
}));

const Swatches = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(9, 16px)',
  gap: 6,
  padding: 3,
  marginTop: 5,
  width: 200,
});

const SwatchColor = styled.div<{ active?: boolean }>(({ theme, active }) => ({
  width: 16,
  height: 16,
  boxShadow: active
    ? `${theme.appBorderColor} 0 0 0 1px inset, ${theme.textMutedColor}50 0 0 0 4px`
    : `${theme.appBorderColor} 0 0 0 1px inset`,
  borderRadius: theme.appBorderRadius,
}));

const swatchBackground = `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill-opacity=".05"><path d="M8 0h8v8H8zM0 8h8v8H0z"/></svg>')`;

type SwatchProps = { value: string } & React.ComponentProps<typeof SwatchColor>;
const Swatch = ({ value, style, ...props }: SwatchProps) => {
  const backgroundImage = `linear-gradient(${value}, ${value}), ${swatchBackground}, linear-gradient(#fff, #fff)`;
  return <SwatchColor {...props} style={{ ...style, backgroundImage }} />;
};

const Input = styled(Form.Input)(({ theme, readOnly }) => ({
  width: '100%',
  paddingLeft: 30,
  paddingRight: 30,
  boxSizing: 'border-box',
  fontFamily: theme.typography.fonts.base,
}));

const ToggleIcon = styled(MarkupIcon)(({ theme }) => ({
  position: 'absolute',
  zIndex: 1,
  top: 6,
  right: 7,
  width: 20,
  height: 20,
  padding: 4,
  boxSizing: 'border-box',
  cursor: 'pointer',
  color: theme.input.color,
}));

enum ColorSpace {
  RGB = 'rgb',
  HSL = 'hsl',
  HEX = 'hex',
}

const COLOR_SPACES = Object.values(ColorSpace);
const COLOR_REGEXP = /\(([0-9]+),\s*([0-9]+)%?,\s*([0-9]+)%?,?\s*([0-9.]+)?\)/;
const RGB_REGEXP = /^\s*rgba?\(([0-9]+),\s*([0-9]+),\s*([0-9]+),?\s*([0-9.]+)?\)\s*$/i;
const HSL_REGEXP = /^\s*hsla?\(([0-9]+),\s*([0-9]+)%,\s*([0-9]+)%,?\s*([0-9.]+)?\)\s*$/i;
const HEX_REGEXP = /^\s*#?([0-9a-f]{3}|[0-9a-f]{6})\s*$/i;
const SHORTHEX_REGEXP = /^\s*#?([0-9a-f]{3})\s*$/i;

type ParsedColor = {
  valid: boolean;
  value: string;
  keyword: string;
  colorSpace: ColorSpace;
  [ColorSpace.RGB]: string;
  [ColorSpace.HSL]: string;
  [ColorSpace.HEX]: string;
};

const ColorPicker = {
  [ColorSpace.HEX]: HexColorPicker,
  [ColorSpace.RGB]: RgbaStringColorPicker,
  [ColorSpace.HSL]: HslaStringColorPicker,
};

const fallbackColor = {
  [ColorSpace.HEX]: 'transparent',
  [ColorSpace.RGB]: 'rgba(0, 0, 0, 0)',
  [ColorSpace.HSL]: 'hsla(0, 0%, 0%, 0)',
};

const stringToArgs = (value: string) => {
  const match = value?.match(COLOR_REGEXP);

  if (!match) {
    return [0, 0, 0, 1];
  }
  const [, x, y, z, a = 1] = match;
  return [x, y, z, a].map(Number);
};

const parseValue = (value: string): ParsedColor | undefined => {
  if (!value) {
    return undefined;
  }
  let valid = true;

  if (RGB_REGEXP.test(value)) {
    const [r, g, b, a] = stringToArgs(value);
    const [h, s, l] = convert.rgb.hsl([r, g, b]) || [0, 0, 0];
    return {
      valid,
      value,
      keyword: convert.rgb.keyword([r, g, b]),
      colorSpace: ColorSpace.RGB,
      [ColorSpace.RGB]: value,
      [ColorSpace.HSL]: `hsla(${h}, ${s}%, ${l}%, ${a})`,
      [ColorSpace.HEX]: `#${convert.rgb.hex([r, g, b]).toLowerCase()}`,
    };
  }

  if (HSL_REGEXP.test(value)) {
    const [h, s, l, a] = stringToArgs(value);
    const [r, g, b] = convert.hsl.rgb([h, s, l]) || [0, 0, 0];
    return {
      valid,
      value,
      keyword: convert.hsl.keyword([h, s, l]),
      colorSpace: ColorSpace.HSL,
      [ColorSpace.RGB]: `rgba(${r}, ${g}, ${b}, ${a})`,
      [ColorSpace.HSL]: value,
      [ColorSpace.HEX]: `#${convert.hsl.hex([h, s, l]).toLowerCase()}`,
    };
  }

  const plain = value.replace('#', '');
  const rgb = convert.keyword.rgb(plain as any) || convert.hex.rgb(plain);
  const hsl = convert.rgb.hsl(rgb);

  let mapped = value;

  if (/[^#a-f0-9]/i.test(value)) {
    mapped = plain;
  } else if (HEX_REGEXP.test(value)) {
    mapped = `#${plain}`;
  }

  if (mapped.startsWith('#')) {
    valid = HEX_REGEXP.test(mapped);
  } else {
    try {
      convert.keyword.hex(mapped as any);
    } catch (e) {
      valid = false;
    }
  }

  return {
    valid,
    value: mapped,
    keyword: convert.rgb.keyword(rgb),
    colorSpace: ColorSpace.HEX,
    [ColorSpace.RGB]: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`,
    [ColorSpace.HSL]: `hsla(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%, 1)`,
    [ColorSpace.HEX]: mapped,
  };
};

const getRealValue = (value: string, color: ParsedColor, colorSpace: ColorSpace) => {
  if (!value || !color?.valid) {
    return fallbackColor[colorSpace];
  }

  if (colorSpace !== ColorSpace.HEX) {
    return color?.[colorSpace] || fallbackColor[colorSpace];
  }
  if (!color.hex.startsWith('#')) {
    try {
      return `#${convert.keyword.hex(color.hex as any)}`;
    } catch (e) {
      return fallbackColor.hex;
    }
  }
  const short = color.hex.match(SHORTHEX_REGEXP);

  if (!short) {
    return HEX_REGEXP.test(color.hex) ? color.hex : fallbackColor.hex;
  }
  const [r, g, b] = short[1].split('');
  return `#${r}${r}${g}${g}${b}${b}`;
};

const useColorInput = (
  initialValue: string | undefined,
  onChange: (value: string) => string | void
) => {
  const [value, setValue] = useState(initialValue || '');
  const [color, setColor] = useState(() => parseValue(value));
  const [colorSpace, setColorSpace] = useState(color?.colorSpace || ColorSpace.HEX);

  // Reset state when initialValue changes (when resetting controls)
  useEffect(() => {
    const nextValue = initialValue || '';
    const nextColor = parseValue(nextValue);
    setValue(nextValue);
    setColor(nextColor);
    setColorSpace(nextColor?.colorSpace || ColorSpace.HEX);
  }, [initialValue]);

  const realValue = useMemo(
    () => getRealValue(value, color, colorSpace).toLowerCase(),
    [value, color, colorSpace]
  );

  const updateValue = useCallback(
    (update: string) => {
      const parsed = parseValue(update);
      const v = parsed?.value || update || '';

      setValue(v);

      if (v === '') {
        setColor(undefined);
        onChange(undefined);
      }

      if (!parsed) {
        return;
      }

      setColor(parsed);
      setColorSpace(parsed.colorSpace);
      onChange(parsed.value);
    },
    [onChange]
  );

  const cycleColorSpace = useCallback(() => {
    let next = COLOR_SPACES.indexOf(colorSpace) + 1;

    if (next >= COLOR_SPACES.length) {
      next = 0;
    }
    setColorSpace(COLOR_SPACES[next]);
    const update = color?.[COLOR_SPACES[next]] || '';
    setValue(update);
    onChange(update);
  }, [color, colorSpace, onChange]);

  return { value, realValue, updateValue, color, colorSpace, cycleColorSpace };
};

const id = (value: string) => value.replace(/\s*/, '').toLowerCase();

const usePresets = (
  presetColors: PresetColor[],
  currentColor: ParsedColor | undefined,
  colorSpace: ColorSpace
) => {
  const [selectedColors, setSelectedColors] = useState(currentColor?.valid ? [currentColor] : []);

  // Reset state when currentColor becomes undefined (when resetting controls)
  useEffect(() => {
    if (currentColor !== undefined) {
      return;
    }
    setSelectedColors([]);
  }, [currentColor]);

  const presets = useMemo(() => {
    const initialPresets = (presetColors || []).map((preset) => {
      if (typeof preset === 'string') {
        return parseValue(preset);
      }

      if (preset.title) {
        return { ...parseValue(preset.color), keyword: preset.title };
      }
      return parseValue(preset.color);
    });
    return initialPresets.concat(selectedColors).filter(Boolean).slice(-27);
  }, [presetColors, selectedColors]);

  const addPreset: (color: ParsedColor) => void = useCallback(
    (color) => {
      if (!color?.valid) {
        return;
      }

      if (presets.some((preset) => id(preset[colorSpace]) === id(color[colorSpace]))) {
        return;
      }
      setSelectedColors((arr) => arr.concat(color));
    },
    [colorSpace, presets]
  );

  return { presets, addPreset };
};

export type ColorControlProps = ControlProps<ColorValue> & ColorConfig;
export const ColorControl: FC<ColorControlProps> = ({
  name,
  value: initialValue,
  onChange,
  onFocus,
  onBlur,
  presetColors,
  startOpen = false,
  argType,
}) => {
  const debouncedOnChange = useCallback(debounce(onChange, 200), [onChange]);
  const { value, realValue, updateValue, color, colorSpace, cycleColorSpace } = useColorInput(
    initialValue,
    debouncedOnChange
  );
  const { presets, addPreset } = usePresets(presetColors, color, colorSpace);
  const Picker = ColorPicker[colorSpace];

  const readonly = !!argType?.table?.readonly;

  return (
    <Wrapper aria-readonly={readonly}>
      <PickerTooltip
        startOpen={startOpen}
        trigger={readonly ? [null] : undefined}
        closeOnOutsideClick
        onVisibleChange={() => addPreset(color)}
        tooltip={
          <TooltipContent>
            <Picker
              color={realValue === 'transparent' ? '#000000' : realValue}
              {...{ onChange: updateValue, onFocus, onBlur }}
            />
            {presets.length > 0 && (
              <Swatches>
                {presets.map((preset, index: number) => (
                  <WithTooltip
                    key={`${preset.value}-${index}`}
                    hasChrome={false}
                    tooltip={<Note note={preset.keyword || preset.value} />}
                  >
                    <Swatch
                      value={preset[colorSpace]}
                      active={color && id(preset[colorSpace]) === id(color[colorSpace])}
                      onClick={() => updateValue(preset.value)}
                    />
                  </WithTooltip>
                ))}
              </Swatches>
            )}
          </TooltipContent>
        }
      >
        <Swatch value={realValue} style={{ margin: 4 }} />
      </PickerTooltip>
      <Input
        id={getControlId(name)}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => updateValue(e.target.value)}
        onFocus={(e: FocusEvent<HTMLInputElement>) => e.target.select()}
        readOnly={readonly}
        placeholder="Choose color..."
      />
      {value ? <ToggleIcon onClick={cycleColorSpace} /> : null}
    </Wrapper>
  );
};

export default ColorControl;
