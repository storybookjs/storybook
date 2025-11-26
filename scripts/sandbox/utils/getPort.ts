import { allTemplates } from '../../../lib/cli-storybook/src/sandbox-templates';
import { type TemplateDetails, tasks } from '../../task';

export function getPort(template: Pick<TemplateDetails, 'key' | 'selectedTask'>) {
  const templateIndex = Object.values(allTemplates).indexOf(allTemplates[template.key]);
  const taskIndex = Object.values(tasks).indexOf(tasks[template.selectedTask]);

  if (templateIndex === -1 || taskIndex === -1) {
    throw new Error(`Template ${template.key} or task ${template.selectedTask} not found`);
  }

  return 3000 + templateIndex * 100 + taskIndex;
}
