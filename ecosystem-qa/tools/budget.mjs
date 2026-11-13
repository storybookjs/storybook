#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Tells the agent where the run is in its time budget. The runner writes budget.json into the
// evidence directory before the sandbox starts. Plain JavaScript without dependencies, because it
// runs on the Node of the tested project.
const [evidenceDir] = process.argv.slice(2);
if (!evidenceDir) {
  console.error('Usage: node budget.mjs <evidence dir>');
  process.exit(2);
}

const { startedAt, minutes, hardStopMinutes } = JSON.parse(
  readFileSync(`${evidenceDir}/budget.json`, 'utf8')
);
const minute = Math.floor((Date.now() - Date.parse(startedAt)) / 60_000);
const left = Math.ceil(minutes - (Date.now() - Date.parse(startedAt)) / 60_000);
const leftText = `${left} ${left === 1 ? 'minute is' : 'minutes are'} left`;

if (left <= 0) {
  console.log(
    `The run budget of ${minutes} minutes is used up: this is minute ${minute}. Stop working now. Give every check you did not get to the state "skip" with the note "the run budget was used up", stop your servers, and write the final answer. At minute ${hardStopMinutes} the run is stopped from outside, and an answer that is not printed by then may be lost.`
  );
} else if (left <= 10) {
  console.log(
    `Minute ${minute} of ${minutes}: ${leftText}. Finish what you are on and write the final answer before the budget is over.`
  );
} else {
  console.log(`Minute ${minute} of ${minutes}: ${leftText}.`);
}
