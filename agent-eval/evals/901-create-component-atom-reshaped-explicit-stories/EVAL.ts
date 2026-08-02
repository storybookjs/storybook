import { describe, test } from 'vitest';
import { expectWorkflowCalls } from '#test-utils';

describe('creating an accessible ToggleSwitch with explicit stories requested', () => {
  test('uses Storybook story instructions and previews the stories', () => {
    expectWorkflowCalls(['get-storybook-story-instructions', 'preview-stories']);
  });
});
