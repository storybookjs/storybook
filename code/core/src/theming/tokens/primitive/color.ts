export const accent = 212;

const colors = {
  neutral: {
    hue: accent,
    saturation: 10,
  },
  blue: {
    hue: accent,
    saturation: 54,
  },
  purple: {
    hue: 271,
    saturation: 48,
  },
  red: {
    hue: 16,
    saturation: 100,
  },
  gold: {
    hue: 36,
    saturation: 100,
  },
  green: {
    hue: 101,
    saturation: 52,
  },
  cyan: {
    hue: 179,
    saturation: 48,
  },
};

type Lightness =
  | 'l4'
  | 'l8'
  | 'l12'
  | 'l16'
  | 'l20'
  | 'l24'
  | 'l28'
  | 'l32'
  | 'l36'
  | 'l40'
  | 'l44'
  | 'l48'
  | 'l52'
  | 'l56'
  | 'l60'
  | 'l64'
  | 'l68'
  | 'l72'
  | 'l76'
  | 'l80'
  | 'l84'
  | 'l88'
  | 'l92'
  | 'l96';

type Color = {
  [key in keyof typeof colors]: key extends 'neutral'
    ? { [key in Lightness | 'white' | 'black']: string }
    : { [key in Lightness]: string };
};

export const color = {} as Color;

const generateLightness = (name: keyof typeof colors, h: number, s: number) => {
  const palette: Partial<Color[typeof name]> = {};

  for (let l = 4; l < 100; l += 4) {
    const key = `l${l}` as keyof Color[typeof name];
    palette[key] = `hsl(${h} ${s}% ${l}%)`;
  }

  return palette as Color[typeof name];
};

color.neutral = {
  ...generateLightness('neutral', colors.neutral.hue, colors.neutral.saturation),
  white: '#FFFFFF',
  black: '#000000',
};

for (const key in colors) {
  if (key !== 'neutral') {
    const colorKey = key as keyof Omit<typeof colors, 'neutral'>;
    color[colorKey] = generateLightness(
      colorKey,
      colors[colorKey].hue,
      colors[colorKey].saturation
    );
  }
}

// This should pass
const passingTest = color.blue.l44;

// This should fail
//const failingTest = color.neutral.l55;
