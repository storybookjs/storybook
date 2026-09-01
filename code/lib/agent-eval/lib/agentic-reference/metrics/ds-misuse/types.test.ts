import { MISUSE_FACET_IDS } from '@storybook/agent-eval-utils';
import { describe, expect, it } from 'vitest';

import { JUDGE_OUTPUT_SCHEMA } from './types.ts';

describe('JUDGE_OUTPUT_SCHEMA', () => {
  const answer = JUDGE_OUTPUT_SCHEMA.properties.nodes.items.properties.correctDsUsage;

  it('constrains reason facets to exactly the misuse facet ids', () => {
    expect(answer.properties.reasons.items.properties.facet.enum).toEqual(MISUSE_FACET_IDS);
  });

  it('requires score and reasons, facet stays optional', () => {
    expect(answer.required).toEqual(['score', 'reasons']);
    expect(answer.properties.reasons.items.required).toEqual(['text']);
  });
});
