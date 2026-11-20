#!/usr/bin/env node
// Stands in for `gh` in the command tests: it answers the GraphQL queries for the discussion
// categories and the discussions of a category from the JSON file $GH_STAND_IN_STATE, records each
// call there, and adds a discussion of the workflow for `createDiscussion`.
import { readFileSync, writeFileSync } from 'node:fs';

const statePath = process.env.GH_STAND_IN_STATE;
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
const fields = Object.fromEntries(
  args.flatMap((arg, index) => (args[index - 1] === '-f' ? [arg.split(/=(.*)/s, 2)] : []))
);
const answer = (value) => {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  process.stdout.write(`${JSON.stringify(value)}\n`);
};
const query = args[0] === 'api' && args[1] === 'graphql' ? (fields.query ?? '') : '';

if (query.includes('discussionCategories')) {
  answer({
    data: {
      repository: {
        id: 'R_1',
        discussionCategories: { nodes: [{ id: 'DIC_qa', name: 'QA sweeps' }] },
      },
    },
  });
} else if (query.includes('createDiscussion')) {
  const number = 1000 + state.discussions.length;
  const url = `https://github.com/storybookjs/storybook/discussions/${number}`;
  state.discussions.push({
    id: `D_${number}`,
    number,
    url,
    title: fields.title,
    body: fields.body,
    categoryId: fields.categoryId,
    author: { __typename: 'Bot', login: 'github-actions' },
    authorAssociation: 'NONE',
    editor: null,
  });
  answer({ data: { createDiscussion: { discussion: { id: `D_${number}`, url } } } });
} else if (query.includes('discussions(')) {
  const nodes = state.discussions.filter((d) => d.categoryId === fields.category);
  answer([{ data: { repository: { discussions: { nodes } } } }]);
} else {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  process.stderr.write(`gh stand-in: no answer for ${args.join(' ')}\n`);
  process.exit(1);
}
