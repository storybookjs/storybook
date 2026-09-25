import { describe, expect, it } from 'vitest';

import { loadAnnotationFile } from 'storybook/internal/csf-tools';

import { ComponentSubtitleMigrationError } from './component-subtitle-transform.ts';
import { transformPreviewSource, transformStorySource } from './component-subtitle.ts';

const transforms = { preview: transformPreviewSource, stories: transformStorySource };

describe('component-subtitle spreads', () => {
  it('rejects an unresolved spread that may supply docs.subtitle', () => {
    for (const transform of Object.values(transforms)) {
      expect(() =>
        transform(`export default {
        parameters: { ...parameters, componentSubtitle: 'Legacy' }
      };`)
      ).toThrow(ComponentSubtitleMigrationError);
    }
  });

  it('migrates a subtitle declared through a local parameters spread', () => {
    const source = `const legacyParameters = { componentSubtitle: 'Legacy' };
export default { parameters: { ...legacyParameters } };`;
    expect(
      Object.fromEntries(
        Object.entries(transforms).map(([kind, transform]) => [kind, transform(source)])
      )
    ).toMatchInlineSnapshot(`
      {
        "preview": "const legacyParameters = { docs: {
        subtitle: 'Legacy'
      } };
      export default { parameters: { ...legacyParameters } };",
        "stories": "const legacyParameters = { docs: {
        subtitle: 'Legacy'
      } };
      export default { parameters: { ...legacyParameters } };",
      }
    `);
  });

  it('rejects a local spread alias with another consumer', () => {
    for (const transform of Object.values(transforms)) {
      expect(() =>
        transform(`
        const parameters = { componentSubtitle: 'Legacy' };
        consume(parameters);
        export default { parameters: { ...parameters } };
      `)
      ).toThrow(ComponentSubtitleMigrationError);
    }
  });

  it('preserves legacy fallbacks for falsy subtitles', () => {
    const outputs = ["''", 'false', '0', 'null', 'undefined'].map((subtitle) => {
      const source = `export default { parameters: {
        componentSubtitle: 'Legacy', docs: { subtitle: ${subtitle}, source: 'keep' }
      } };`;
      const preview = transformPreviewSource(source);
      const stories = transformStorySource(source);
      for (const [kind, output] of Object.entries({ preview, stories }) as Array<
        ['preview' | 'stories', string]
      >) {
        expect(
          loadAnnotationFile(output, kind).objects[0].getValue(['parameters', 'docs', 'subtitle'])
        ).toBe('Legacy');
      }
      return { preview, stories };
    });
    expect(outputs).toMatchInlineSnapshot(`
      [
        {
          "preview": "export default { parameters: {
        docs: { subtitle: 'Legacy', source: 'keep' }
      } };",
          "stories": "export default { parameters: {
        docs: { subtitle: "Legacy", source: 'keep' }
      } };",
        },
        {
          "preview": "export default { parameters: {
        docs: { subtitle: 'Legacy', source: 'keep' }
      } };",
          "stories": "export default { parameters: {
        docs: { subtitle: "Legacy", source: 'keep' }
      } };",
        },
        {
          "preview": "export default { parameters: {
        docs: { subtitle: 'Legacy', source: 'keep' }
      } };",
          "stories": "export default { parameters: {
        docs: { subtitle: "Legacy", source: 'keep' }
      } };",
        },
        {
          "preview": "export default { parameters: {
        docs: { subtitle: 'Legacy', source: 'keep' }
      } };",
          "stories": "export default { parameters: {
        docs: { subtitle: "Legacy", source: 'keep' }
      } };",
        },
        {
          "preview": "export default { parameters: {
        docs: { subtitle: 'Legacy', source: 'keep' }
      } };",
          "stories": "export default { parameters: {
        docs: { subtitle: "Legacy", source: 'keep' }
      } };",
        },
      ]
    `);
  });
});
