// @flow
import React from 'react';
import { storiesOf } from '@storybook/react';
import { withInfo } from '@storybook/addon-info';

import TableComponent from '../components/TableComponent';

import type { JssClasses } from '../types';

type State = {
  value: any,
};

type Props = {
  classes: JssClasses,
  name: string,
};

class Table extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      value: undefined,
    };
  }

  state: State;

  render() {
    return <TableComponent />;
  }
}

const stories = storiesOf('Table', module);
stories.add('Flow Class', withInfo('Lorum Ipsum Nem')(() => <Table />));
