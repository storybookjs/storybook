import { describe, expect, it } from 'vitest';

import { filterDefs, filters } from './visionSimulatorFilters.ts';

describe('filterDefs', () => {
  it('avoids display:none, which makes Firefox ignore CSS url() filters', () => {
    expect(filterDefs).not.toMatch(/display\s*:\s*none/i);
  });

  it('renders in sRGB, the space the color matrices were derived in', () => {
    expect(filterDefs).toContain('color-interpolation-filters="sRGB"');
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
