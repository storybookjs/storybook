// custom-reporter.cjs
// @ts-expect-error no types
import { ReportBase } from 'istanbul-lib-report';

export default class CustomReporter extends ReportBase {
  constructor(opts) {
    super();

    console.log({ opts: opts.foo });

    // Options passed from configuration are available here
    this.file = opts.file;
  }

  onStart(root, context) {
    // console.log("establish Storybook");
    // Establish a connection to the Storybook server
  }

  onDetail(node, context) {
    const fc = node.getFileCoverage();
    console.log({ fc });
    const key = fc.path;
  }

  onEnd() {
    // console.log("COVERAGE COLLECTED");
    // Send to Storybook
  }
}
