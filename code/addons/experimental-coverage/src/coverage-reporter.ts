// custom-reporter.cjs
import type { Channel } from 'storybook/internal/channels';

// @ts-expect-error no types
import { ReportBase } from 'istanbul-lib-report';

import { RESULT_EVENT } from './constants';
import type { State } from './types';

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

  onStart(root, context) {
    // console.log("establish Storybook");
    // Establish a connection to the Storybook server
  }

  onDetail(node) {
    const fc = node.getFileCoverage();

    if (fc.data.path === this.state.current) {
      this.channel.emit(RESULT_EVENT, fc.data);
    }
  }

  onEnd() {
    // console.log("COVERAGE COLLECTED");
    // Send to Storybook
  }
}
