import {
  expectFinalResponseContains,
  expectSkillInvoked,
  expectWorkflowCalls,
  getEvalContext,
  getWorkflowToolResults,
} from '#test-utils';
import { describe, expect, test } from 'vitest';

describe('answering which props ReviewCard accepts', () => {
  const { integration } = getEvalContext();

  test('uses the documentation tooling to resolve props and usage', () => {
    expectWorkflowCalls(['docs-list', 'docs-show']);
    // The answer can come from source after a failed call; at least one `docs show` must succeed.
    expect(getWorkflowToolResults('docs-show').some((result) => !result.isError)).toBe(true);
  });

  test.skipIf(integration === 'mcp')('invokes the component-docs skill', () => {
    expectSkillInvoked('component-docs');
  });

  // The fixture component has exactly these three props; a grounded answer
  // names all of them.
  test('the answer covers every ReviewCard prop', () => {
    expectFinalResponseContains(['author', 'rating', 'comment']);
  });
});
