import { describe, expect, it } from 'vitest';

import { jobTiming, report, toMarkdown } from './circleci-benchmark.ts';

const step = (name: string, actions: [number, string, string][]) => ({
  name,
  actions: actions.map(([index, start_time, end_time]) => ({
    index,
    start_time,
    end_time,
    status: 'success',
  })),
});
const at = (minute: number) => new Date(Date.UTC(2026, 10, 5, 12, minute)).toISOString();

describe('circleci-benchmark', () => {
  it('bills every parallel container from its first step to its last', () => {
    const agent = jobTiming({
      workflows: { job_name: 'nx-agent' },
      picard: { resource_class: { class: 'xlarge', executor: 'docker' } },
      steps: [
        step('Spin up environment', [
          [0, at(0), at(1)],
          [1, at(0), at(1)],
        ]),
        step('Run the tasks NX Cloud assigns', [
          [0, at(1), at(5)],
          [1, at(1), at(7)],
        ]),
      ],
    });

    expect(agent.containerMinutes).toBe(12);
  });

  it('splits the main job into setup and tasks, and times the green check', () => {
    const main = jobTiming({
      workflows: { job_name: 'nx-main' },
      start_time: at(1),
      picard: { resource_class: { class: 'large', executor: 'docker' } },
      steps: [step('Checkout code', [[0, at(1), at(2)]]), step('Run nx', [[0, at(2), at(6)]])],
    });
    const completion = jobTiming({
      workflows: { job_name: 'circleci-completion' },
      start_time: at(6),
      stop_time: at(7),
      picard: { resource_class: { class: 'small', executor: 'docker' } },
      steps: [step('Workflow completed', [[0, at(6), at(7)]])],
    });
    const result = report(
      { name: 'normal-nx-dte-generated', status: 'success', created_at: at(0), stopped_at: at(8) },
      [main, completion]
    );

    expect(result).toMatchObject({
      greenMinutes: 7,
      wallMinutes: 8,
      setupMinutes: 1,
      taskMinutes: 4,
      credits: 5 * 20 + 1 * 5,
    });
    expect(toMarkdown([result])).toContain(
      '| normal-nx-dte-generated | success | 2 | 7m00s | 8m00s |'
    );
  });
});
