import { logger } from '@storybook/client-logger';

function hashCode(str: string): string {
  const h = str
    .split('')
    // eslint-disable-next-line no-bitwise
    .reduce((prevHash, currVal) => ((prevHash << 5) - prevHash + currVal.charCodeAt(0)) | 0, 0);

  return Math.abs(h).toString(16);
}

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

  if (!name) {
    throw new Error('Id or Name should be specified');
  }

  let generated = name.replace(/\W+(.|$)/g, (_, chr) => chr.toUpperCase());
  if (allocatedIds.indexOf(generated) >= 0) {
    logger.warn(`Story name conflict with exports - Please add an explicit id for story ${name}`);
    generated += hashCode(name);
  }
  return generated;
}
