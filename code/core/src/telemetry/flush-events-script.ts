// Passed to `node --eval` as source, so the process that runs it needs nothing from the Storybook
// install: `yarn dlx` removes that install as soon as the command exits.
export const flushEventsScript = `
const { readFileSync, rmSync } = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');

const url = process.env.STORYBOOK_TELEMETRY_URL || 'https://storybook.js.org/event-log';
const file = process.argv.at(-1);
const contents = readFileSync(file, 'utf8');
// Removed before anything can fail, so a file is never left behind.
rmSync(file, { force: true });
const signal = AbortSignal.timeout(30_000);

async function post(event) {
  for (let attempt = 0; ; attempt += 1) {
    let status;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal,
      });
      await response.text();
      status = response.status;
    } catch {}
    // A request can fail after the server stored the event; the eventId lets it drop the retry.
    const retry = status === undefined || status === 503 || status === 504;
    if (!retry || attempt === 3 || signal.aborted) {
      return;
    }
    await sleep(2 ** attempt * 1000, undefined, { signal }).catch(() => {});
  }
}

(async () => {
  // One at a time, so the events arrive in the order they occurred.
  for (const event of JSON.parse(contents)) {
    await post(event);
  }
})();
`;
