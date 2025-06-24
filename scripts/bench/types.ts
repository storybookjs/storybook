// NOTE: this must be kept in sync with ./bench.schema, which defines
// the table schema in BigQuery
export interface BenchResults {
  branch: string;
  commit: string;
  timestamp: string;
  label: string;

  /** The time it takes to create the base sandbox without storybook */
  createTime: number;
  /** The time it takes to install the base sandbox after it has been initialized */
  generateTime: number;
  /** The time it takes to run `sb init` on the base sandbox */
  initTime: number;
  /** Size of base sandbox node_modules without storybook pre-install */
  createSize: number;
  /** Size of base sandbox node_modules without storybook post-install */
  generateSize: number;
  /** Size of the sandbox node_modules post `sb init` */
  initSize: number;
  /** Difference bewtween `initSize` and `generateSize` */
  diffSize: number;
  /** Full `sb build` time */
  buildTime: number;
  /** Size of the storybook-static directory in total */
  buildSize: number;
  /** Size of the storybook-static/sb-addons in total */
  buildSbAddonsSize: number;
  /** Size of the storybook-static/sb-common-assets */
  buildSbCommonSize: number;
  /** Size of the storybook-static/sb-manager */
  buildSbManagerSize: number;
  /** Size of storybook-static/sb-preview */
  buildSbPreviewSize: number;
  /** Size of the `static` directory if it exists */
  buildStaticSize: number;
  /** Total size of `sb-x` above */
  buildPrebuildSize: number;
  /** Total size of everything else (user's stories & components & CSS & assets etc.) */
  buildPreviewSize: number;
  /** Full `sb build` time */
  testBuildTime: number;
  /** Size of the storybook-static directory in total */
  testBuildSize: number;
  /** Size of the storybook-static/sb-addons in total */
  testBuildSbAddonsSize: number;
  /** Size of the storybook-static/sb-common-assets */
  testBuildSbCommonSize: number;
  /** Size of the storybook-static/sb-manager */
  testBuildSbManagerSize: number;
  /** Size of storybook-static/sb-preview */
  testBuildSbPreviewSize: number;
  /** Size of the `static` directory if it exists */
  testBuildStaticSize: number;
  /** Total size of `sb-x` above */
  testBuildPrebuildSize: number;
  /** Total size of everything else (user's stories & components & CSS & assets etc.) */
  testBuildPreviewSize: number;
  /** Time to wait-on iframe.html */
  devPreviewResponsive: number;
  /** Time to wait-on index.html */
  devManagerResponsive: number;
  /** Time to browse to index.html and view the SB logo */
  devManagerHeaderVisible: number;
  /** Time to browse to index.html and load the story index */
  devManagerIndexVisible: number;
  /**
   * Time to browse to index.html and load iframe content and the story is rendered, for the very
   * first run
   */
  devStoryVisibleUncached: number;
  /** Time to browse to index.html and load iframe content and the story is rendered */
  devStoryVisible: number;
  /** Time to browse to index.html and load iframe content and the docs page is rendered */
  devAutodocsVisible: number;
  /** Time to browse to index.html and load iframe content and the MDX page is rendered */
  devMDXVisible: number;
  /** Time to browse to index.html and view the SB logo */
  buildManagerHeaderVisible: number;
  /** Time to browse to index.html and load the story index */
  buildManagerIndexVisible: number;
  /** Time to browse to index.html and load iframe content and the story is rendered */
  buildStoryVisible: number;
  /** Time to browse to index.html and load iframe content and the docs page is rendered */
  buildAutodocsVisible: number;
  /** Time to browse to index.html and load iframe content and the MDX page is rendered */
  buildMDXVisible: number;
}
