import React, { Component } from 'react';

interface IFrameProps {
  id: string;
  key?: string;
  title: string;
  src: string;
  allowFullScreen: boolean;
  style?: any;
}

export class IFrame extends Component<IFrameProps> {
  // Never updates: its user keys it by URL, so a new URL is a new iframe.
  shouldComponentUpdate() {
    return false;
  }

  render() {
    const { id, title, src, allowFullScreen, ...rest } = this.props;
    return (
      <iframe
        id={id}
        title={title}
        src={src}
        {...(allowFullScreen ? { allow: 'fullscreen' } : {})}
        loading="lazy"
        {...rest}
      />
    );
  }
}
