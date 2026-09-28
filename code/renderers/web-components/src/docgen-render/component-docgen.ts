import type { BeforeEach, DocgenPayload } from 'storybook/internal/types';

import { logger } from 'storybook/internal/client-logger';

import { global } from '@storybook/global';
import { getService } from 'storybook/preview-api';
import type { DocgenService } from 'storybook/open-service';

import type { StoryContext, WebComponentsRenderer } from '../types.ts';

export const loadComponentDocgen: BeforeEach<WebComponentsRenderer> = async (context) => {
  const service = docgenService();
  if (!service) {
    return;
  }

  const { componentId: id } = context;
  if (service.queries.docgen.get({ id }) !== undefined) {
    return;
  }

  try {
    await service.queries.docgen.loaded({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Server docgen for "${id}" did not load, args are assigned as properties: ${message}`
    );
  }
};

export function getComponentDocgen(context: StoryContext): DocgenPayload | undefined {
  return docgenService()?.queries.docgen.get({ id: context.componentId });
}

function docgenService(): DocgenService | undefined {
  if (!global.FEATURES?.experimentalDocgenServer) {
    return undefined;
  }

  try {
    return getService('core/docgen', { internal: true });
  } catch {
    return undefined;
  }
}
