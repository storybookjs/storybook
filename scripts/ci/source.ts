// 'bench-packages': {
//   executor: {
//     class: 'small',
//     name: 'sb_node_22_classic',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       when: {
//         condition: {
//           and: ['<< pipeline.parameters.ghBaseBranch >>', '<< pipeline.parameters.ghPrNumber >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'yarn bench-packages --base-branch << pipeline.parameters.ghBaseBranch >> --pull-request << pipeline.parameters.ghPrNumber >> --upload',
//               name: 'Benchmarking packages against base branch',
//               working_directory: 'scripts',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           or: [
//             {
//               not: '<< pipeline.parameters.ghBaseBranch >>',
//             },
//             {
//               not: '<< pipeline.parameters.ghPrNumber >>',
//             },
//           ],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command: 'yarn bench-packages --upload',
//               name: 'Uploading package benchmarks for branch',
//               working_directory: 'scripts',
//             },
//           },
//         ],
//       },
//     },
//     {
//       store_artifacts: {
//         path: 'bench/packages/results.json',
//       },
//     },
//     'report-workflow-on-failure',
//     'cancel-workflow-on-failure',
//   ],
// },
// 'bench-sandboxes': {
//   executor: {
//     class: 'small',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task bench)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn task --task bench --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task bench) --no-link --start-from=never --junit',
//         name: 'Running Bench',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn upload-bench $(yarn get-template --cadence << pipeline.parameters.workflow >> --task bench) << pipeline.parameters.ghPrNumber >> << pipeline.parameters.ghBaseBranch >>',
//         name: 'Uploading results',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task bench)',
//       },
//     },
//   ],
// },

// 'check-sandboxes': {
//   executor: {
//     class: 'medium',
//     name: 'sb_node_22_classic',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task check-sandbox)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn task --task check-sandbox --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task check-sandbox) --no-link --start-from=never --junit',
//         name: 'Type check Sandboxes',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task check-sandbox)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'chromatic-internal-storybook': {
//   environment: {
//     NODE_OPTIONS: '--max_old_space_size=4096',
//   },
//   executor: {
//     class: 'large',
//     name: 'sb_node_22_browsers',
//   },
//   steps: [
//     'checkout',
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'yarn storybook:ui:chromatic',
//         name: 'Running Chromatic',
//         working_directory: 'code',
//       },
//     },
//     'report-workflow-on-failure',
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'chromatic-sandboxes': {
//   executor: {
//     class: 'medium',
//     name: 'sb_node_22_browsers',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     'checkout',
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task chromatic)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn task --task chromatic --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task chromatic) --no-link --start-from=never --junit',
//         name: 'Running Chromatic',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task chromatic)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// coverage: {
//   executor: {
//     class: 'small',
//     name: 'sb_node_22_browsers',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     'codecov/upload',
//     'report-workflow-on-failure',
//   ],
// },
// 'create-sandboxes': {
//   executor: {
//     class: 'large',
//     name: 'sb_node_22_browsers',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           '# Enable corepack\nsudo corepack enable\n\n# Verify yarn is working\nwhich yarn\nyarn --version\n',
//         name: 'Setup Corepack',
//       },
//     },
//     'start-event-collector',
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task sandbox)\nyarn task --task build --template $TEMPLATE --no-link --start-from=sandbox --junit\nif [[ $TEMPLATE != bench/* ]]; then\n  yarn --cwd scripts jiti ./event-log-checker.ts build $TEMPLATE\nfi\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && rm -rf node_modules\n',
//         environment: {
//           STORYBOOK_TELEMETRY_DEBUG: 1,
//           STORYBOOK_TELEMETRY_URL: 'http://localhost:6007/event-log',
//         },
//         name: 'Create Sandboxes',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task sandbox)',
//       },
//     },
//     {
//       persist_to_workspace: {
//         paths: ['sandbox/**'],
//         root: '.',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'e2e-dev': {
//   executor: {
//     class: 'medium+',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests-dev)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")\necho "$TEST_FILES" | circleci tests run --command="xargs yarn task --task e2e-tests-dev --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests-dev) --no-link --start-from=never --junit" --verbose --index=0 --total=1\n',
//         name: 'Running E2E Tests',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests-dev)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     {
//       store_artifacts: {
//         destination: 'playwright',
//         path: 'code/playwright-results/',
//       },
//     },
//   ],
// },
// 'e2e-production': {
//   executor: {
//     class: 'medium',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEST_FILES=$(circleci tests glob "code/e2e-tests/*.{test,spec}.{ts,js,mjs}")\necho "$TEST_FILES" | circleci tests run --command="xargs yarn task --task e2e-tests --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests) --no-link --start-from=never --junit" --verbose --index=0 --total=1\n',
//         name: 'Running E2E Tests',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task e2e-tests)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     {
//       store_artifacts: {
//         destination: 'playwright',
//         path: 'code/playwright-results/',
//       },
//     },
//   ],
// },
// 'e2e-ui': {
//   executor: {
//     class: 'medium',
//     name: 'sb_playwright',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install --no-immutable',
//         environment: {
//           YARN_ENABLE_IMMUTABLE_INSTALLS: false,
//         },
//         name: 'Install dependencies',
//         working_directory: 'test-storybooks/portable-stories-kitchen-sink/react',
//       },
//     },
//     {
//       run: {
//         command: 'yarn playwright-e2e',
//         name: 'Run E2E tests',
//         working_directory: 'test-storybooks/portable-stories-kitchen-sink/react',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     {
//       store_artifacts: {
//         destination: 'playwright',
//         path: 'test-storybooks/portable-stories-kitchen-sink/react/test-results/',
//       },
//     },
//     'report-workflow-on-failure',
//   ],
// },
// 'e2e-ui-vitest-3': {
//   executor: {
//     class: 'medium',
//     name: 'sb_playwright',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install --no-immutable',
//         environment: {
//           YARN_ENABLE_IMMUTABLE_INSTALLS: false,
//         },
//         name: 'Install dependencies',
//         working_directory: 'test-storybooks/portable-stories-kitchen-sink/react-vitest-3',
//       },
//     },
//     {
//       run: {
//         command: 'yarn playwright-e2e',
//         name: 'Run E2E tests',
//         working_directory: 'test-storybooks/portable-stories-kitchen-sink/react-vitest-3',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     {
//       store_artifacts: {
//         destination: 'playwright',
//         path: 'test-storybooks/portable-stories-kitchen-sink/react-vitest-3/test-results/',
//       },
//     },
//     'report-workflow-on-failure',
//   ],
// },
// knip: {
//   executor: {
//     class: 'large',
//     name: 'sb_node_22_classic',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'cd code\nyarn knip --no-exit-code\n',
//         name: 'Knip',
//       },
//     },
//     'report-workflow-on-failure',
//     'cancel-workflow-on-failure',
//   ],
// },
// lint: {
//   executor: {
//     class: 'medium+',
//     name: 'sb_node_22_classic',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'cd code\nyarn lint\n',
//         name: 'Lint',
//       },
//     },
//     'report-workflow-on-failure',
//     'cancel-workflow-on-failure',
//   ],
// },
// 'smoke-test-sandboxes': {
//   executor: {
//     class: 'medium',
//     name: 'sb_node_18_browsers',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn task --task smoke-test --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task smoke-test) --no-link --start-from=never --junit',
//         name: 'Smoke Testing Sandboxes',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task smoke-test)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'stories-tests': {
//   executor: {
//     class: 'xlarge',
//     name: 'sb_playwright',
//   },
//   parallelism: 2,
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'cd code\nTEST_FILES=$(circleci tests glob "**/*.{stories}.{ts,tsx,js,jsx,cjs}" | sed "/^e2e-tests\\//d" | sed "/^node_modules\\//d")\necho "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=../test-results/junit-${CIRCLE_NODE_INDEX}.xml" --verbose\n',
//         name: 'Run tests',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     'report-workflow-on-failure',
//     'cancel-workflow-on-failure',
//   ],
// },
// 'test-init-empty': {
//   executor: {
//     class: 'small',
//     name: 'sb_node_22_browsers',
//   },
//   parameters: {
//     packageManager: {
//       type: 'string',
//     },
//     template: {
//       type: 'string',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['npm', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nnpm set registry http://localhost:6001\nnpx storybook init --yes --package-manager npm\nnpm run storybook -- --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (NPM)',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['yarn2', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nyarn set version berry\nyarn config set registry http://localhost:6001\nyarn dlx storybook init --yes --package-manager yarn2\nyarn storybook --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (Yarn 2)',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['pnpm', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nnpm i -g pnpm\npnpm config set registry http://localhost:6001\npnpm dlx storybook init --yes --package-manager pnpm\npnpm run storybook --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (PNPM)',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['react-vite-ts', '<< parameters.template >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>-no-install\ncd empty-<< parameters.template >>-no-install\nnpx storybook init --yes --skip-install\nnpm install\nnpm run build-storybook\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (--skip-install)',
//             },
//           },
//         ],
//       },
//     },
//     'report-workflow-on-failure',
//   ],
// },
// 'test-init-empty-windows': {
//   executor: 'win/default',
//   parameters: {
//     packageManager: {
//       type: 'string',
//     },
//     template: {
//       type: 'string',
//     },
//   },
//   steps: [
//     'checkout',
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'choco install nodejs-lts --version=22.11.0 -y\ncorepack enable\n',
//         name: 'Setup Node & Yarn on Windows',
//         shell: 'bash.exe',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install',
//         name: 'Install code dependencies',
//         shell: 'bash.exe',
//         working_directory: 'code',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install',
//         name: 'Install script dependencies',
//         shell: 'bash.exe',
//         working_directory: 'scripts',
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['npm', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nnpm set registry http://localhost:6001\nnpx storybook init --yes --package-manager npm\nnpm run storybook -- --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (Windows NPM)',
//               shell: 'bash.exe',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['yarn2', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nyarn set version berry\nyarn config set registry http://localhost:6001\nyarn dlx storybook init --yes --package-manager yarn2\nyarn storybook --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (Windows Yarn 2)',
//               shell: 'bash.exe',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['pnpm', '<< parameters.packageManager >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>\ncd empty-<< parameters.template >>\nnpm i -g pnpm\npnpm config set registry http://localhost:6001\npnpm dlx storybook init --yes --package-manager pnpm\npnpm run storybook --smoke-test\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (Windows PNPM)',
//               shell: 'bash.exe',
//             },
//           },
//         ],
//       },
//     },
//     {
//       when: {
//         condition: {
//           equal: ['react-vite-ts', '<< parameters.template >>'],
//         },
//         steps: [
//           {
//             run: {
//               background: true,
//               command: 'cd code\nyarn local-registry --open\n',
//               name: 'Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//               name: 'Wait on Verdaccio',
//               shell: 'bash.exe',
//             },
//           },
//           {
//             run: {
//               command:
//                 'cd ..\nmkdir empty-<< parameters.template >>-no-install\ncd empty-<< parameters.template >>-no-install\nnpx storybook init --yes --skip-install\nnpm install\nnpm run build-storybook\n',
//               environment: {
//                 IN_STORYBOOK_SANDBOX: true,
//                 STORYBOOK_DISABLE_TELEMETRY: true,
//                 STORYBOOK_INIT_EMPTY_TYPE: '<< parameters.template >>',
//               },
//               name: 'Storybook init from empty directory (Windows --skip-install)',
//               shell: 'bash.exe',
//             },
//           },
//         ],
//       },
//     },
//   ],
// },
// 'test-init-features': {
//   executor: {
//     class: 'small',
//     name: 'sb_node_22_browsers',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         background: true,
//         command: 'cd code\nyarn local-registry --open\n',
//         name: 'Verdaccio',
//       },
//     },
//     {
//       run: {
//         command: 'cd code\nyarn wait-on tcp:127.0.0.1:6001\nyarn wait-on tcp:127.0.0.1:6002\n',
//         name: 'Wait on Verdaccio',
//       },
//     },
//     {
//       run: {
//         command:
//           'cd ..\nmkdir features-1\ncd features-1\nnpm set registry http://localhost:6001\nnpx create-storybook --yes --package-manager npm --features docs test a11y --loglevel=debug\nnpx vitest\n',
//         environment: {
//           IN_STORYBOOK_SANDBOX: true,
//           STORYBOOK_DISABLE_TELEMETRY: true,
//           STORYBOOK_INIT_EMPTY_TYPE: 'react-vite-ts',
//         },
//         name: 'Storybook init for features',
//       },
//     },
//   ],
// },
// 'test-portable-stories': {
//   executor: {
//     class: 'medium',
//     name: 'sb_playwright',
//   },
//   parameters: {
//     directory: {
//       type: 'string',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install --no-immutable',
//         environment: {
//           YARN_ENABLE_IMMUTABLE_INSTALLS: false,
//         },
//         name: 'Install dependencies',
//         working_directory:
//           'test-storybooks/portable-stories-kitchen-sink/<< parameters.directory >>',
//       },
//     },
//     {
//       run: {
//         command: 'yarn jest',
//         name: 'Run Jest tests',
//         working_directory:
//           'test-storybooks/portable-stories-kitchen-sink/<< parameters.directory >>',
//       },
//     },
//     {
//       run: {
//         command: 'yarn vitest',
//         name: 'Run Vitest tests',
//         working_directory:
//           'test-storybooks/portable-stories-kitchen-sink/<< parameters.directory >>',
//       },
//     },
//     {
//       run: {
//         command: 'yarn playwright-ct',
//         name: 'Run Playwright CT tests',
//         working_directory:
//           'test-storybooks/portable-stories-kitchen-sink/<< parameters.directory >>',
//       },
//     },
//     {
//       run: {
//         command: 'yarn cypress',
//         name: 'Run Cypress CT tests',
//         working_directory:
//           'test-storybooks/portable-stories-kitchen-sink/<< parameters.directory >>',
//       },
//     },
//     'report-workflow-on-failure',
//   ],
// },
// 'test-runner-dev': {
//   executor: {
//     class: 'large',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn task --task test-runner-dev --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner-dev) --no-link --start-from=never --junit',
//         name: 'Running Test Runner in Dev mode',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner-dev)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'test-runner-production': {
//   executor: {
//     class: 'medium+',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     'start-event-collector',
//     {
//       run: {
//         command:
//           'yarn task --task test-runner --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner) --no-link --start-from=never --junit',
//         environment: {
//           STORYBOOK_TELEMETRY_DEBUG: 1,
//           STORYBOOK_TELEMETRY_URL: 'http://localhost:6007/event-log',
//         },
//         name: 'Running Test Runner',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn --cwd scripts jiti ./event-log-checker.ts test-run $(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner)',
//         name: 'Check Telemetry',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task test-runner)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
// 'test-yarn-pnp': {
//   executor: {
//     class: 'medium',
//     name: 'sb_playwright',
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command: 'yarn install --no-immutable',
//         environment: {
//           YARN_ENABLE_IMMUTABLE_INSTALLS: false,
//         },
//         name: 'Install dependencies',
//         working_directory: 'test-storybooks/yarn-pnp',
//       },
//     },
//     {
//       run: {
//         command: 'yarn storybook --smoke-test',
//         name: 'Run Storybook smoke test',
//         working_directory: 'test-storybooks/yarn-pnp',
//       },
//     },
//     'report-workflow-on-failure',
//   ],
// },
// 'unit-tests': {
//   executor: {
//     class: 'xlarge',
//     name: 'sb_playwright',
//   },
//   parallelism: 2,
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'cd code\nTEST_FILES=$(circleci tests glob "**/*.{test,spec,stories}.{ts,tsx,js,jsx,cjs}" | sed "/^e2e-tests\\//d" | sed "/^node_modules\\//d")\necho "$TEST_FILES" | circleci tests run --command="xargs yarn test --reporter=junit --reporter=default --outputFile=../test-results/junit-${CIRCLE_NODE_INDEX}.xml" --verbose\n',
//         name: 'Run tests',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//     'report-workflow-on-failure',
//     'cancel-workflow-on-failure',
//   ],
// },
// 'vitest-integration': {
//   executor: {
//     class: 'xlarge',
//     name: 'sb_playwright',
//   },
//   parallelism: '<< parameters.parallelism >>',
//   parameters: {
//     parallelism: {
//       type: 'integer',
//     },
//   },
//   steps: [
//     {
//       'git-shallow-clone/checkout_advanced': {
//         clone_options: '--depth 1 --verbose',
//       },
//     },
//     {
//       attach_workspace: {
//         at: '.',
//       },
//     },
//     {
//       run: {
//         command:
//           'TEMPLATE=$(yarn get-template --cadence << pipeline.parameters.workflow >> --task vitest-integration)\ncd sandbox/$(yarn get-sandbox-dir --template $TEMPLATE) && yarn\n',
//         name: 'Install sandbox dependencies',
//       },
//     },
//     'start-event-collector',
//     {
//       run: {
//         command:
//           'yarn task --task vitest-integration --template $(yarn get-template --cadence << pipeline.parameters.workflow >> --task vitest-integration) --no-link --start-from=never --junit',
//         environment: {
//           STORYBOOK_TELEMETRY_DEBUG: 1,
//           STORYBOOK_TELEMETRY_URL: 'http://localhost:6007/event-log',
//         },
//         name: 'Running story tests in Vitest',
//       },
//     },
//     {
//       run: {
//         command:
//           'yarn --cwd scripts jiti ./event-log-checker.ts test-run $(yarn get-template --cadence << pipeline.parameters.workflow >> --task vitest-integration)',
//         name: 'Check Telemetry',
//       },
//     },
//     {
//       'report-workflow-on-failure': {
//         template:
//           '$(yarn get-template --cadence << pipeline.parameters.workflow >> --task vitest-integration)',
//       },
//     },
//     {
//       store_test_results: {
//         path: 'test-results',
//       },
//     },
//   ],
// },
