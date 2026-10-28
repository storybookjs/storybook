import { describe, expect, it } from 'vitest';

import { summarizeStoryDocsForTelemetry } from './telemetry.ts';

describe('summarizeStoryDocsForTelemetry', () => {
  it('returns undefined when the index has no story', () => {
    const index = { v: 5, entries: {} };

    expect(summarizeStoryDocsForTelemetry(index, [])).toBeUndefined();
  });

  it('counts stories with an error or without story docs as errors', () => {
    const index = {
      v: 5,
      entries: {
        'button--primary': {
          id: 'button--primary',
          name: 'Primary',
          title: 'Button',
          type: 'story',
          subtype: 'story',
          importPath: './Button.stories.ts',
        },
        'button--partial': {
          id: 'button--partial',
          name: 'Partial',
          title: 'Button',
          type: 'story',
          subtype: 'story',
          importPath: './Button.stories.ts',
        },
        'button--broken': {
          id: 'button--broken',
          name: 'Broken',
          title: 'Button',
          type: 'story',
          subtype: 'story',
          importPath: './Button.stories.ts',
        },
        'card--default': {
          id: 'card--default',
          name: 'Default',
          title: 'Card',
          type: 'story',
          subtype: 'story',
          importPath: './Card.stories.ts',
        },
      },
    } as const;
    const snapshots = [
      {
        components: {
          button: {
            id: 'button',
            name: 'Button',
            path: './Button.stories.ts',
            stories: {
              'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
              'button--partial': {
                id: 'button--partial',
                name: 'Partial',
                snippet: '<Button />',
                warning: 'args.onClick',
              },
              'button--broken': {
                id: 'button--broken',
                name: 'Broken',
                error: { name: 'Error', message: 'Provider failed' },
              },
            },
          },
        },
      },
    ];

    expect(summarizeStoryDocsForTelemetry(index, snapshots)).toMatchInlineSnapshot(`
      {
        "errorRatio": 0.5,
        "warningRatio": 0.25,
      }
    `);
  });
});
