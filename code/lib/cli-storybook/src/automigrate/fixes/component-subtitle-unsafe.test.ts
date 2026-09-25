import { describe, expect, it } from 'vitest';

import { ComponentSubtitleMigrationError } from './component-subtitle-transform.ts';
import { transformPreviewSource, transformStorySource } from './component-subtitle.ts';

describe('component-subtitle unsafe inputs', () => {
  it('rejects a story migration when an inherited subtitle can win', () => {
    expect(() =>
      transformStorySource(`
        export default { parameters: { docs: { subtitle: 'Meta subtitle' } } };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a falsy descendant subtitle that needs the inherited legacy fallback', () => {
    expect(() =>
      transformStorySource(`
      export default { parameters: { componentSubtitle: 'Meta' } };
      export const Primary = { parameters: { docs: { subtitle: '' } } };
    `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects an unresolved existing subtitle instead of dropping the fallback', () => {
    expect(() =>
      transformStorySource(`
      export default { parameters: {
        componentSubtitle: 'Legacy', docs: { subtitle: getSubtitle() }
      } };
    `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a meta migration when a preview subtitle can win', () => {
    expect(() =>
      transformStorySource(
        `export default { parameters: { componentSubtitle: 'Meta subtitle' } };`,
        { subtitleCanWin: true }
      )
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a story migration when meta parameters are indirect', () => {
    expect(() =>
      transformStorySource(`
        const parameters = { docs: { subtitle: 'Meta subtitle' } };
        export default { parameters };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects side-effectful componentSubtitle expressions', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: registerSubtitle(),
            docs: { subtitle: 'Current' }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('ignores unrelated component props with the same name', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = { args: { componentSubtitle: 'A component prop' } };
      `)
    ).toBeNull();
  });

  it('reports uninspectable parameters instead of guessing whether a legacy value exists', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: getParameters({ args: { componentSubtitle: 'A component prop' } })
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects spread parameters', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...parameters,
            componentSubtitle: 'Legacy'
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a shared componentSubtitle parameters spread', () => {
    expect(() =>
      transformStorySource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        consume(legacyParameters);
        export default {
          parameters: { ...legacyParameters }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a componentSubtitle inside a conditional parameters spread', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...(enabled ? { componentSubtitle: 'Legacy' } : {})
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects an unresolvable parameters spread containing a structural candidate', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...getParameters({ componentSubtitle: 'Legacy' })
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects shared parameter aliases and a cyclic spread reference', () => {
    expect(() =>
      transformStorySource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        consume(legacyParameters);
        const parametersAlias = legacyParameters;
        const secondAlias = parametersAlias;
        export default { parameters: { ...secondAlias } };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(() =>
      transformStorySource(`
        const firstAlias = secondAlias;
        const secondAlias = firstAlias;
        export default { parameters: { ...firstAlias, componentSubtitle: 'Legacy' } };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects componentSubtitle accessors and methods', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            get componentSubtitle() { return 'Legacy'; }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle() { return 'Legacy'; }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('classifies parameters methods and accessors only when their bodies contain a candidate', () => {
    expect(
      transformStorySource(`
        export default {
          parameters() { return { backgrounds: {} }; }
        };
      `)
    ).toBeNull();

    expect(() =>
      transformStorySource(`
        export default {
          get parameters() {
            return { componentSubtitle: 'Legacy' };
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(() =>
      transformStorySource(`
        export default {
          parameters: getParameters({ componentSubtitle: 'Legacy' })
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(
      transformStorySource(`
        export default {
          parameters: getParameters({ backgrounds: {} })
        };
      `)
    ).toBeNull();
  });

  it('rejects a docs.subtitle accessor', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: {
              get subtitle() { return 'Current'; }
            }
          }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a story migration when an inherited docs.subtitle is an accessor', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            docs: {
              get subtitle() { return 'Meta subtitle'; }
            }
          }
        };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('classifies unresolved computed parameters keys only with structural evidence', () => {
    expect(() =>
      transformStorySource(`
        const parameterName = getParameterName();
        export default {
          [parameterName]: { componentSubtitle: 'Legacy' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);

    expect(
      transformStorySource(`
        const parameterName = getParameterName();
        export default {
          [parameterName]: { backgrounds: {} }
        };
      `)
    ).toBeNull();
  });

  it('rejects a componentSubtitle spread inside a wrapped preview export', () => {
    expect(() =>
      transformPreviewSource(`
        const legacyParameters = { componentSubtitle: 'Legacy' };
        consume(legacyParameters);
        export default definePreview({
          parameters: { ...legacyParameters }
        });
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects top-level spread composition that can hide subtitle parameters', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { docs: { subtitle: 'Meta' } } };
        export default { ...base };
        export const Primary = {
          parameters: { componentSubtitle: 'Legacy' }
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a conditional root spread containing a structural candidate', () => {
    expect(() =>
      transformStorySource(`
        export default {
          ...(enabled ? { parameters: { componentSubtitle: 'Legacy' } } : {})
        };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });

  it('rejects a spread-only direct story export', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { componentSubtitle: 'Legacy' } };
        export default {};
        export const Primary = { ...base };
      `)
    ).toThrow(ComponentSubtitleMigrationError);
  });
});
