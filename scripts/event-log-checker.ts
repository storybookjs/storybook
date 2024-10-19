import assert from 'assert';
import picocolors from 'picocolors';

import versions from '../code/core/src/common/versions';
import { oneWayHash } from '../code/core/src/telemetry/one-way-hash';
import { allTemplates } from '../code/lib/cli-storybook/src/sandbox-templates';
import { esMain } from './utils/esmain';

const PORT = process.env.PORT || 6007;

const eventTypeExpectations = {
  build: {},
};

async function run() {
  const [eventType, templateName] = process.argv.slice(2);
  let testMessage = '';

  // very simple jest-like test fn for better error readability
  const test = (message: string, fn: () => void) => {
    testMessage = message;
    fn();
  };

  try {
    if (!eventType || !templateName) {
      throw new Error(
        `Need eventType and templateName; call with ./event-log-checker <eventType> <templateName>`
      );
    }

    const expectation = eventTypeExpectations[eventType as keyof typeof eventTypeExpectations];

    if (!expectation) {
      throw new Error(`Unexpected eventType '${eventType}'`);
    }

    const template = allTemplates[templateName as keyof typeof allTemplates];

    if (!template) {
      throw new Error(`Unexpected template '${templateName}'`);
    }

    const events = await (await fetch(`http://localhost:${PORT}/event-log`)).json();

    test('Should log 2 events', () => {
      assert.equal(
        events.length,
        2,
        `Expected 2 events but received ${
          events.length
        } instead. The following events were logged: ${JSON.stringify(events)}`
      );
    });

    const [bootEvent, mainEvent] = events;

    test(`both events should have cliVersion in context`, () => {
      const cliVersion = versions.storybook;
      assert.equal(bootEvent.context.cliVersion, cliVersion);
      assert.equal(mainEvent.context.cliVersion, cliVersion);
    });

    test(`Should log a boot event with a payload of type ${eventType}`, () => {
      assert.equal(bootEvent.eventType, 'boot');
      assert.equal(bootEvent.payload?.eventType, eventType);
    });

    test(`main event should be ${eventType} and contain correct id and session id`, () => {
      assert.equal(mainEvent.eventType, eventType);
      assert.notEqual(mainEvent.eventId, bootEvent.eventId);
      assert.equal(mainEvent.sessionId, bootEvent.sessionId);
    });

    test(`main event should contain anonymousId properly hashed`, () => {
      const templateDir = `sandbox/${templateName.replace('/', '-')}`;
      const unhashedId = `github.com/storybookjs/storybook.git${templateDir}`;
      assert.equal(mainEvent.context.anonymousId, oneWayHash(unhashedId));
    });

    const {
      expected: { renderer, builder, framework },
    } = template;

    test(`main event should contain correct packages from template's "expected" field`, () => {
      assert.equal(mainEvent.metadata.renderer, renderer);
      assert.equal(mainEvent.metadata.builder, builder);
      assert.equal(mainEvent.metadata.framework.name, framework);
    });
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      console.log(`Assertions failed for ${picocolors.bold(templateName)}\n`);
      console.log(picocolors.bold(picocolors.red(`✕ ${testMessage}:`)));
      console.log(err);
      process.exit(1);
    }
    throw err;
  }
}

export {};

if (esMain(import.meta.url)) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.log(err);
      process.exit(1);
    });
}
