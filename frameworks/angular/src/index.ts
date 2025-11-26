export * from './client/index';
export * from './types';

/*
 * ATTENTION:
 * - moduleMetadata
 * - NgModuleMetadata
 * - ICollection
 *
 * These typings are coped out of decorators.d.ts and types.d.ts in order to fix a bug with tsc
 * It was imported out of dist before which was not the proper way of exporting public API
 *
 * This can be fixed by migrating app/angular to typescript
 */
