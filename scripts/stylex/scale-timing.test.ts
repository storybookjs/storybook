import { describe, expect, it } from 'vitest';

import { generateScaleFixture } from './scale-timing.ts';

describe('generateScaleFixture', () => {
  it('generates one component and one story per component, plus a themed story', () => {
    const files = Object.keys(generateScaleFixture(250));

    expect(files.filter((file) => /\/C\d+\.tsx$/.test(file))).toHaveLength(250);
    expect(files.filter((file) => /\/C\d+\.stories\.tsx$/.test(file))).toHaveLength(250);
    expect(files.filter((file) => file.endsWith('Themed.stories.tsx'))).toHaveLength(1);
    expect(files.every((file) => file.startsWith('src/stylex-scale/'))).toBe(true);
  });

  it('gives every component its own padding, read from the tokens', () => {
    const files = generateScaleFixture(3);

    expect(files['src/stylex-scale/C3.tsx']).toContain('padding: 3');
    expect(files['src/stylex-scale/C3.tsx']).toContain('color: colors.primary');
    expect(files['src/stylex-scale/C3.stories.tsx']).toContain("title: 'StyleXScale/C3'");
  });
});
