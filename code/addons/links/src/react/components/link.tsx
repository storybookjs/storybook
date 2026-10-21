import type { MouseEvent, ReactNode } from 'react';
import React, { PureComponent } from 'react';

import type { ComponentTitle, StoryName } from 'storybook/internal/types';

import { hrefTo, navigate } from '../../utils.ts';

// FIXME: copied from Typography.Link. Code is duplicated to
// avoid emotion dependency which breaks React 15.x back-compat

// Cmd/Ctrl/Shift/Alt + Click should trigger default browser behaviour. Same applies to non-left clicks
const LEFT_BUTTON = 0;

const isPlainLeftClick = (e: MouseEvent<HTMLAnchorElement>) =>
  e.button === LEFT_BUTTON && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

const cancelled = (e: MouseEvent<HTMLAnchorElement>, cb = (_e: any) => {}) => {
  if (isPlainLeftClick(e)) {
    e.preventDefault();
    cb(e);
  }
};

interface Props {
  title?: ComponentTitle;
  name?: StoryName;
  children: ReactNode;
}

interface State {
  href: string;
}

export default class LinkTo extends PureComponent<Props, State> {
  static defaultProps: Props = {
    children: undefined,
  };

  state: State = {
    href: '/',
  };

  componentDidMount() {
    this.updateHref();
  }

  componentDidUpdate(prevProps: Props) {
    const { title, name } = this.props;

    if (prevProps.title !== title || prevProps.name !== name) {
      this.updateHref();
    }
  }

  updateHref = async () => {
    const { title, name } = this.props;
    if (title && name) {
      const href = await hrefTo(title, name);
      this.setState({ href });
    }
  };

  handleClick = () => {
    const { title, name } = this.props;
    if (title && name) {
      navigate({ title, name });
    }
  };

  render() {
    const { title, name, children, ...rest } = this.props;
    const { href } = this.state;

    return (
      <a href={href} onClick={(e) => cancelled(e, this.handleClick)} {...rest}>
        {children}
      </a>
    );
  }
}
