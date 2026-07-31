import { describe, expect, it } from 'vitest';

import { parseLatencyChildResult } from './spawn.ts';

const expectedWorkload = {
  name: 'flat',
  packages: 1,
  componentsPerPackage: 5,
  chainDepth: 1,
  fanOut: 2,
  heavyLib: false,
  saves: 3,
};

function resultJson(options: Record<string, unknown>) {
  return JSON.stringify({
    options,
    cold: { durationMs: 100, members: 25 },
    warm: [
      { save: 1, durationMs: 10, members: 5 },
      { save: 2, durationMs: 11, members: 5 },
      { save: 3, durationMs: 12, members: 5 },
    ],
    diagnostics: { absoluteLog: '/absolute/private/child.log' },
    peakRssMb: 512,
  });
}

describe('parseLatencyChildResult', () => {
  it('validates the echoed workload and persists only latency observations', () => {
    const result = parseLatencyChildResult(
      resultJson({
        scenario: 'flat',
        packages: 1,
        componentsPerPackage: 5,
        chainDepth: 1,
        fanOut: 2,
        heavyLib: false,
        saves: 3,
        outDir: '/absolute/private/project',
        jsonOut: '/absolute/private/result.json',
        parser: 'vue-component-meta',
        scope: 'changed',
        pin: 'next',
      }),
      expectedWorkload
    );

    expect(result).toEqual({
      cold: { durationMs: 100, members: 25 },
      warm: [
        { save: 1, durationMs: 10, members: 5 },
        { save: 2, durationMs: 11, members: 5 },
        { save: 3, durationMs: 12, members: 5 },
      ],
    });
    expect(result).not.toHaveProperty('options');
    expect(result).not.toHaveProperty('diagnostics');
    expect(result).not.toHaveProperty('peakRssMb');
    expect(JSON.stringify(result)).not.toContain('/absolute/private');
  });

  it('maps scenario param name to the child scenario option', () => {
    expect(() =>
      parseLatencyChildResult(
        resultJson({
          scenario: 'workspace',
          packages: 1,
          componentsPerPackage: 5,
          chainDepth: 1,
          fanOut: 2,
          heavyLib: false,
          saves: 3,
        }),
        expectedWorkload
      )
    ).toThrow('child echoed workload option "scenario" as "workspace", expected "flat"');
  });

  it('rejects a missing echoed workload parameter or options envelope', () => {
    expect(() =>
      parseLatencyChildResult(
        resultJson({
          scenario: 'flat',
          packages: 1,
          componentsPerPackage: 5,
          chainDepth: 1,
          fanOut: 2,
          heavyLib: false,
        }),
        expectedWorkload
      )
    ).toThrow('child result is missing echoed workload option "saves"');

    expect(() =>
      parseLatencyChildResult(
        JSON.stringify({ cold: { durationMs: 1 }, warm: [{ save: 1, durationMs: 1 }] }),
        expectedWorkload
      )
    ).toThrow('child result is missing its parsed options envelope');
  });
});
