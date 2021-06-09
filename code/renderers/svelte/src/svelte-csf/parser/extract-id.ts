import { logger } from '@storybook/client-logger';

// extract a story id
export function extractId(
  {
    id,
    name,
  }: {
    id?: string;
    name?: string;
  },
  allocatedIds: string[] = []
): string {
  if (id) {
    return id;
  }

  let generated = name.replace(/\W+(.)/g, (_, chr) => chr.toUpperCase());
  if (allocatedIds.indexOf(generated) >= 0) {
    logger.warn(`Story name conflict with exports - Please add an explicit id for story ${name}`);
    generated += hashCode(name);
  }
  return generated;
}

function hashCode(str: string): string {
  return str
    .split('')
    .reduce((prevHash, currVal) => ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0, 0) // eslint-disable-line
    .toString(16);
}
