import { describe, expect, it } from 'vitest';

import { creditsOf, jobTiming, report, toMarkdown } from './circleci-benchmark.ts';

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
      picard: { executor: 'docker', resource_class: { class: 'xlarge' } },
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

  it('prices a Windows job by its executor, as CircleCI reports it', () => {
    const windows = jobTiming({
      workflows: { job_name: 'windows--unit-1' },
      picard: { executor: 'windows', resource_class: { class: 'large' } },
      steps: [step('Unit tests', [[0, at(0), at(10)]])],
    });

    expect(creditsOf(windows)).toBe(10 * 120);
  });

  it('refuses to price a machine it does not know', () => {
    const unknown = jobTiming({
      workflows: { job_name: 'mystery' },
      picard: { executor: 'macos', resource_class: { class: 'm4pro.medium' } },
      steps: [step('Run', [[0, at(0), at(1)]])],
    });

    expect(() => creditsOf(unknown)).toThrow('No credit price for docker m4pro.medium');
  });

  it('splits the main job into setup and tasks, and times the green check', () => {
    const main = jobTiming({
      workflows: { job_name: 'nx-main' },
      start_time: at(1),
      stop_time: at(6),
      picard: { executor: 'docker', resource_class: { class: 'large' } },
      steps: [step('Checkout code', [[0, at(1), at(2)]]), step('Run nx', [[0, at(2), at(6)]])],
    });
    const completion = jobTiming({
      workflows: { job_name: 'circleci-completion' },
      start_time: at(6),
      stop_time: at(7),
      picard: { executor: 'docker', resource_class: { class: 'small' } },
      steps: [step('Workflow completed', [[0, at(6), at(7)]])],
    });
    const result = report(
      { name: 'normal-nx-dte-generated', status: 'success', created_at: at(0), stopped_at: at(8) },
      [main, completion]
    );

    expect(result).toMatchObject({
      greenMinutes: 7,
      mainMinutes: 6,
      wallMinutes: 8,
      setupMinutes: 1,
      taskMinutes: 4,
      credits: 5 * 20 + 1 * 5,
    });
    expect(toMarkdown([result])).toContain(
      '| normal-nx-dte-generated | success | 2 | 7m00s | 6m00s | – | 8m00s |'
    );
  });

  it('counts from the setup job, whose credits it adds, and times the Windows main job', () => {
    const setup = jobTiming({
      workflows: { job_name: 'generate-and-run-config' },
      queued_at: at(-1),
      start_time: at(-1),
      stop_time: at(0),
      picard: { executor: 'docker', resource_class: { class: 'large' } },
      steps: [step('Select the tasks to run', [[0, at(-1), at(0)]])],
    });
    const windowsMain = jobTiming({
      workflows: { job_name: 'nx-main-windows' },
      start_time: at(1),
      stop_time: at(9),
      picard: { executor: 'windows', resource_class: { class: 'medium' } },
      steps: [step('Run nx', [[0, at(1), at(9)]])],
    });
    const result = report(
      { name: 'daily-nx-dte-generated', status: 'success', created_at: at(0), stopped_at: at(10) },
      [windowsMain],
      setup
    );

    expect(result).toMatchObject({
      jobs: 2,
      wallMinutes: 11,
      windowsMainMinutes: 10,
      credits: 1 * 20 + 8 * 40,
    });
  });
});
