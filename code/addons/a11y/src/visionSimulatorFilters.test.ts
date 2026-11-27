import { describe, expect, it } from 'vitest';

import { filterDefs, filters } from './visionSimulatorFilters.ts';

describe('anomaly simulations', () => {
  it('does not offer the anomalies that the dichromacy simulations are the severe form of', () => {
    for (const anomaly of ['protanomaly', 'deuteranomaly', 'tritanomaly']) {
      expect(filters).not.toHaveProperty(anomaly);
      expect(filterDefs).not.toContain(`storybook-a11y-vision-${anomaly}`);
    }
  });
});

describe('filterDefs', () => {
  it('avoids display:none, which makes Firefox ignore CSS url() filters', () => {
    expect(filterDefs).not.toMatch(/display\s*:\s*none/i);
    expect(filterDefs).toContain('aria-hidden="true"');
    expect(filterDefs).toContain('position:absolute');
    expect(filterDefs).toContain('width:0');
    expect(filterDefs).toContain('height:0');
    expect(filterDefs).toContain('overflow:hidden');
  });

  it('renders in linearRGB, the color space the matrices are defined in', () => {
    expect(filterDefs).toContain('color-interpolation-filters="linearRGB"');
    expect(filterDefs).not.toContain('color-interpolation-filters="sRGB"');
  });

  const matricesFor = (id: string) => {
    const filter = filterDefs.match(new RegExp(`<filter id="${id}">([\\s\\S]*?)</filter>`))?.[1];

    return [...(filter ?? '').matchAll(/values="([^"]+)"/g)].map(([, values]) =>
      values.replace(/[\s,]+/g, ' ').trim()
    );
  };
  const matrixFor = (id: string) => matricesFor(id)[0];

  it('uses the Machado et al. severity 1.0 matrices', () => {
    expect(matrixFor('storybook-a11y-vision-protanopia')).toBe(
      '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0'
    );
    expect(matrixFor('storybook-a11y-vision-deuteranopia')).toBe(
      '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0'
    );
    expect(matrixFor('storybook-a11y-vision-tritanopia-machado')).toBe(
      '1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0'
    );
  });

  it('matches the Brettel et al. half-plane projection for tritanopia', () => {
    type Vector = [number, number, number];
    const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a: Vector, b: Vector): Vector => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const apply = (rows: Vector[], v: Vector) => rows.map((row) => dot(row, v)) as Vector;
    const multiply = (a: Vector[], b: Vector[]) =>
      a.map((row) => [0, 1, 2].map((j) => dot(row, [b[0][j], b[1][j], b[2][j]])) as Vector);
    const invert = ([a, b, c]: Vector[]) => {
      const determinant = dot(a, cross(b, c));
      const columns = [cross(b, c), cross(c, a), cross(a, b)];
      return [0, 1, 2].map((i) => columns.map((column) => column[i] / determinant) as Vector);
    };
    const clamp = (value: number) => Math.min(1, Math.max(0, value));

    const xyzFromLinearSrgb: Vector[] = [
      [0.4124564, 0.3575761, 0.1804375],
      [0.2126729, 0.7151522, 0.072175],
      [0.0193339, 0.119192, 0.9503041],
    ];
    // The Smith & Pokorny (1975) cone fundamentals.
    const lmsFromXyz: Vector[] = [
      [0.15514, 0.54312, -0.03286],
      [-0.15514, 0.45684, 0.03286],
      [0, 0, 0.01608],
    ];
    // CIE 1931 color matching functions at 485 nm and 660 nm, the hues a tritanope keeps.
    const anchors: Vector[] = [
      [0.05795, 0.1693, 0.6162],
      [0.1649, 0.061, 0],
    ];

    const lmsFromRgb = multiply(lmsFromXyz, xyzFromLinearSrgb);
    const rgbFromLms = invert(lmsFromRgb);
    const white = apply(lmsFromRgb, [1, 1, 1]);
    const divider = cross(white, [0, 0, 1]);
    const halfPlanes = anchors.map((anchor) => {
      const onPlane = apply(lmsFromXyz, anchor);
      return { side: Math.sign(dot(divider, onPlane)), normal: cross(white, onPlane) };
    });
    const brettel = (rgb: Vector) => {
      const [l, m] = apply(lmsFromRgb, rgb);
      const { normal } =
        halfPlanes.find(({ side }) => side === Math.sign(dot(divider, [l, m, 0]))) ?? halfPlanes[0];
      const s = -(normal[0] * l + normal[1] * m) / normal[2];

      return apply(rgbFromLms, [l, m, s]).map(clamp);
    };

    const stages = matricesFor('storybook-a11y-vision-tritanopia').map((values) =>
      values.split(' ').map(Number)
    );
    const filter = (rgb: Vector) =>
      stages.reduce<number[]>(
        (color, m) =>
          [0, 5, 10].map((row) =>
            clamp(m[row] * color[0] + m[row + 1] * color[1] + m[row + 2] * color[2])
          ),
        rgb
      );

    const levels = [0, 0.05, 0.25, 0.5, 0.75, 1];
    for (const r of levels) {
      for (const g of levels) {
        for (const b of levels) {
          const expected = brettel([r, g, b]);
          filter([r, g, b]).forEach((channel, index) =>
            expect(channel).toBeCloseTo(expected[index], 4)
          );
        }
      }
    }
  });

  it('uses the sRGB relative luminance weights for achromatopsia', () => {
    expect(matrixFor('storybook-a11y-vision-achromatopsia')).toBe(
      '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0'
    );
  });

  it('lifts every color channel by half of the linear range for reduced contrast', () => {
    const filter = filterDefs.match(
      /<filter id="storybook-a11y-vision-reduced-contrast">([\s\S]*?)<\/filter>/
    )?.[1];

    expect(filter?.match(/<feFunc[RGB] type="linear" intercept="0.5" \/>/g)).toHaveLength(3);
    expect(filter).not.toContain('feFuncA');
  });

  it('defines an SVG filter for every url() option', () => {
    const referenced = Object.values(filters)
      .map(({ filter }) => filter.match(/^url\("#(.+)"\)$/)?.[1])
      .filter((id) => id !== undefined);

    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(filterDefs).toContain(`<filter id="${id}">`);
    }
  });
});
