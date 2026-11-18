import React, { type FC } from 'react';

import { addons, types } from 'storybook/manager-api';

enum Kind {
  Tool = 'tool',
}

const identity = <T,>(value: T): T => value;

const Tool: FC<{ kind: Kind }> = ({ kind }) => <b>{kind satisfies string}</b>;

addons.register('config', () =>
  addons.add('config/tool', {
    type: types.TOOL,
    title: identity(Kind.Tool),
    render: () => <Tool kind={Kind.Tool} />,
  })
);
