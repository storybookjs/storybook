// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { AxeResults } from 'axe-core';

import { withLinkPaths } from './a11yRunnerUtils';

describe('a11yRunnerUtils', () => {
  describe('withLinkPaths', () => {
    it('should add link paths to the axe results', () => {
      const axeResults = {
        violations: [
          {
            id: 'color-contrast',
            nodes: [
              {
                html: '<button>Click me</button>',
                target: ['.button'],
              },
              {
                html: '<a href="#">Link</a>',
                target: ['.link'],
              },
            ],
          },
        ],
        passes: [
          {
            id: 'button-name',
            nodes: [
              {
                html: '<button>Valid Button</button>',
                target: ['.valid-button'],
              },
            ],
          },
        ],
        incomplete: [
          {
            id: 'aria-valid',
            nodes: [
              {
                html: '<div aria-label="test">Test</div>',
                target: ['.aria-test'],
              },
            ],
          },
        ],
        inapplicable: [],
      } as unknown as AxeResults;

      const result = withLinkPaths(axeResults, 'test-story-id');

      expect(result.violations[0].nodes[0].linkPath).toBe(
        '/?path=/story/test-story-id&addonPanel=storybook/a11y/panel&a11ySelection=violations.color-contrast.1'
      );
      expect(result.violations[0].nodes[1].linkPath).toBe(
        '/?path=/story/test-story-id&addonPanel=storybook/a11y/panel&a11ySelection=violations.color-contrast.2'
      );

      expect(result.passes[0].nodes[0].linkPath).toBe(
        '/?path=/story/test-story-id&addonPanel=storybook/a11y/panel&a11ySelection=passes.button-name.1'
      );

      expect(result.incomplete[0].nodes[0].linkPath).toBe(
        '/?path=/story/test-story-id&addonPanel=storybook/a11y/panel&a11ySelection=incomplete.aria-valid.1'
      );
    });
  });
});
