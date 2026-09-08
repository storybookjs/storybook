import { describe, expect, it } from 'vitest';

import { filterDefs, filters } from './visionSimulatorFilters.ts';

describe('filterDefs', () => {
  it('avoids display:none, which makes Firefox ignore CSS url() filters', () => {
    expect(filterDefs).not.toMatch(/display\s*:\s*none/i);
  });

  it('renders in linearRGB, the color space used by the Machado matrices', () => {
    expect(filterDefs).toContain('color-interpolation-filters="linearRGB"');
    expect(filterDefs).not.toContain('color-interpolation-filters="sRGB"');
  });

  it('uses the Machado et al. severity 1.0 matrices for dichromacy', () => {
    const matrixFor = (id: string) => {
      const filter = filterDefs.match(new RegExp(`<filter id="${id}">([\\s\\S]*?)</filter>`))?.[1];
      const values = filter?.match(/values="([^"]+)"/)?.[1];

      return values?.replace(/[\s,]+/g, ' ').trim();
    };

    expect(matrixFor('storybook-a11y-vision-protanopia')).toBe(
      '0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0'
    );
    expect(matrixFor('storybook-a11y-vision-deuteranopia')).toBe(
      '0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0'
    );
    expect(matrixFor('storybook-a11y-vision-tritanopia')).toBe(
      '1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0'
    );
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
