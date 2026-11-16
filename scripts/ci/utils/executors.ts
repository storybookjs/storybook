import { LINUX_ROOT_DIR, WORKING_DIR } from './constants.ts';

export const executors = {
  sb_node_22_browsers: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:22.22.3-browsers',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${LINUX_ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_node_22_classic: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:22.22.3',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${LINUX_ROOT_DIR}/${WORKING_DIR}`,
  },
  // Current release used for the Node 26 smoke job. Not the default image:
  // .nvmrc stays on 22.22.3, which is what every other job runs.
  sb_node_26: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'cimg/node:26.12.0',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${LINUX_ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_playwright: {
    docker: [
      {
        environment: {
          NODE_OPTIONS: '--max_old_space_size=6144',
        },
        image: 'mcr.microsoft.com/playwright:v1.58.2-noble',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${LINUX_ROOT_DIR}/${WORKING_DIR}`,
  },
  sb_barebones: {
    docker: [
      {
        image: 'cimg/base:stable',
      },
    ],
    parameters: {
      class: {
        default: 'small',
        description: 'The Resource class',
        enum: ['small', 'medium', 'medium+', 'large', 'xlarge'],
        type: 'enum',
      },
    },
    resource_class: '<<parameters.class>>',
    working_directory: `${LINUX_ROOT_DIR}/${WORKING_DIR}`,
  },
} as const;
