#!/usr/bin/env node
// Stands in for `gh` in the command tests: it answers the issue search, the listing of the
// workflow's issues, and the open milestones from the JSON file $GH_STAND_IN_STATE, records each
// call there, and adds an issue for `gh issue create`. A new issue is left out of the search until a
// test marks it indexed, as GitHub's search index lags behind a new issue.
import { readFileSync, writeFileSync } from 'node:fs';

const statePath = process.env.GH_STAND_IN_STATE;
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const valueOf = (flag) => args[args.indexOf(flag) + 1];
const answer = (value) => {
  save();
  process.stdout.write(`${JSON.stringify(value)}\n`);
};

if (args[0] === 'issue' && args[1] === 'create') {
  const number = 1000 + state.issues.length;
  const url = `https://github.com/${valueOf('--repo')}/issues/${number}`;
  state.issues.push({
    number,
    html_url: url,
    state: 'open',
    title: valueOf('--title'),
    milestone: valueOf('--milestone'),
    body: readFileSync(valueOf('--body-file'), 'utf8'),
    user: { login: 'github-actions[bot]' },
    author_association: 'NONE',
    indexed: false,
  });
  save();
  process.stdout.write(`${url}\n`);
} else if (args[0] === 'api' && args.includes('search/issues')) {
  const phrase = /"([^"]+)"/.exec(valueOf('-f'))[1];
  answer([{ items: state.issues.filter((i) => i.indexed && i.body.includes(phrase)) }]);
} else if (args[0] === 'api' && args.at(-1).includes('/issues?creator=github-actions%5Bbot%5D')) {
  answer([state.issues.filter((issue) => issue.user.login === 'github-actions[bot]')]);
} else if (args[0] === 'api' && args.at(-1).includes('/milestones?state=open')) {
  answer([state.milestones.map((title) => ({ title }))]);
} else {
  save();
  process.stderr.write(`gh stand-in: no answer for ${args.join(' ')}\n`);
  process.exit(1);
}
