import type { ReactElement, RefObject } from 'react';
import React, { Component } from 'react';

export type IZoomIFrameProps = {
  scale: number;
  children: ReactElement<HTMLIFrameElement>;
  iFrameRef: RefObject<HTMLIFrameElement>;
  active?: boolean;
};

export class ZoomIFrame extends Component<IZoomIFrameProps> {
  // @ts-expect-error (non strict)
  iframe: HTMLIFrameElement = null;

  componentDidMount() {
    const { iFrameRef } = this.props;
    // @ts-expect-error (non strict)
    this.iframe = iFrameRef.current;
  }

  shouldComponentUpdate(nextProps: IZoomIFrameProps) {
    const { scale, active } = this.props;

    if (scale !== nextProps.scale) {
      this.setIframeInnerZoom(nextProps.scale);
    }

    if (active !== nextProps.active) {
      this.iframe.setAttribute('data-is-storybook', nextProps.active ? 'true' : 'false');
    }

    // this component renders an iframe, which gets updates via post-messages
    // never update this component, it will cause the iframe to refresh
    // the only exception is when the url changes, which happens when the version changes
    return nextProps.children.props.src !== this.props.children.props.src;
  }

  setIframeInnerZoom(scale: number) {
    try {
      // @ts-expect-error (non strict)
      Object.assign(this.iframe.contentDocument.body.style, {
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        transform: `scale(${1 / scale})`,
        transformOrigin: 'top left',
      });
    } catch (e) {
      this.setIframeZoom(scale);
    }
  }

  setIframeZoom(scale: number) {
    Object.assign(this.iframe.style, {
      width: `${scale * 100}%`,
      height: `${scale * 100}%`,
      transform: `scale(${1 / scale})`,
      transformOrigin: 'top left',
    });
  }

  render() {
    const { children } = this.props;
    return <>{children}</>;
  }
}
