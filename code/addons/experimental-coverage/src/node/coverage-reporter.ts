// custom-reporter.cjs
import type { Channel } from 'storybook/internal/channels';

// @ts-expect-error no types
import { ReportBase } from 'istanbul-lib-report';

import { RESULT_COVERAGE_EVENT, type ResultCoverageEventPayload } from '../constants';
import type { State } from '../types';

export default class CustomReporter extends ReportBase {
  channel: Channel;

  state: State;

  file: any;

  constructor(options: { channel: Channel; file: any; state: State }) {
    super();

    this.channel = options.channel;
    // Options passed from configuration are available here
    this.file = options.file;
    this.state = options.state;
  }

  async onDetail(node) {
    const coverage = node.getFileCoverage();
    const coverageSummary = node.getCoverageSummary();

    if (coverage.data.path === this.state.absoluteComponentPath) {
      this.channel.emit(RESULT_COVERAGE_EVENT, {
        coverage,
        coverageSummary,
      } satisfies ResultCoverageEventPayload);
    }
  }
}
