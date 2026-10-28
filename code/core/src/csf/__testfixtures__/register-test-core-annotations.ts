import { setCoreAnnotations } from '../core-annotations.ts';

const TEST_CORE_ANNOTATIONS = [{ loaders: [async () => {}] }, { loaders: [async () => {}] }];

// Stands in for the product's built-in features, which core tests must not depend on.
setCoreAnnotations(() => TEST_CORE_ANNOTATIONS);
