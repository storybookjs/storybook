import type { ChannelLike } from 'storybook/internal/channels';

import {
  COMPONENT_BLOCKS_REQUEST,
  COMPONENT_BLOCKS_SERVER,
  STATIC_COMPONENT_BLOCKS_FILE,
} from '../constants.ts';
import type { Block } from '../parser/types.ts';

export type ComponentBlocksServer = {
  port: number;
  entry: string;
};

const SCRIPT_MARKER = 'data-manager-docs-blocks';

export function hasComponentBlocks(blocks: readonly Block[]): boolean {
  return blocks.some((block) => block.type === 'component');
}

export function componentBlocksUrl(
  server: ComponentBlocksServer,
  location: Pick<Location, 'protocol' | 'hostname'>
): string {
  return `${location.protocol}//${location.hostname}:${server.port}${server.entry}`;
}

export function staticComponentBlocksUrl(
  location: Pick<Location, 'href'> | { href: string } = { href: './' }
): string {
  return new URL(`./${STATIC_COMPONENT_BLOCKS_FILE}`, location.href).href;
}

function appendBlocksScript(doc: Document, src: string): void {
  if (doc.querySelector(`script[${SCRIPT_MARKER}]`)) {
    return;
  }
  const script = doc.createElement('script');
  script.type = 'module';
  script.src = src;
  script.setAttribute(SCRIPT_MARKER, '');
  doc.head.append(script);
}

// Dev asks the preview builder where the bundle is served. Production loads the file next to the manager.
export function loadComponentBlocks(
  channel: Pick<ChannelLike, 'on' | 'off' | 'emit'>,
  doc: Document,
  production = false
): () => void {
  if (production) {
    appendBlocksScript(doc, staticComponentBlocksUrl(doc.location));
    return () => {};
  }
  const onServer = (server: ComponentBlocksServer) => {
    appendBlocksScript(doc, componentBlocksUrl(server, doc.location));
  };
  channel.on(COMPONENT_BLOCKS_SERVER, onServer);
  channel.emit(COMPONENT_BLOCKS_REQUEST);
  return () => channel.off(COMPONENT_BLOCKS_SERVER, onServer);
}
